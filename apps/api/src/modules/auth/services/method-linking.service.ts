import { ARGON2_OPTIONS } from '@modules/auth/constants/auth.constants.js';
import {
  AUTH_LAST_METHOD,
  AUTH_METHOD_NOT_FOUND,
} from '@modules/auth/constants/linking-errors.constants.js';
import { EmailFlowService } from '@modules/auth/services/email-flow.service.js';
import { ConflictError } from '@modules/common/errors/conflict.error.js';
import { NotFoundError } from '@modules/common/errors/not-found.error.js';
import { AUTH_METHOD_LINKED_EVENT } from '@modules/event/constants/event-names.constants.js';
import { EventBusService } from '@modules/event/services/event-bus.service.js';
import { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
import {
  AUTH_EMAIL_LINKED_TO_OTHER_ACCOUNT,
  AUTH_METHOD_ALREADY_LINKED,
} from '@modules/oauth/constants/oauth-errors.constants.js';
import type { AuthMethodInterface } from '@modules/user/interfaces/auth-method.interface.js';
import type { UserWithMethodTypesInterface } from '@modules/user/interfaces/user-with-method-types.interface.js';
import { UserService } from '@modules/user/services/user.service.js';
import { AuthMethodTypeEnum } from '@nest-aws-starter/shared';
import { Injectable } from '@nestjs/common';
import { hash } from 'argon2';

@Injectable()
export class MethodLinkingService {
  private readonly logger = new CustomLoggerService(MethodLinkingService.name);

  constructor(
    private readonly userService: UserService,
    private readonly emailFlowService: EmailFlowService,
    private readonly eventBus: EventBusService,
  ) {}

  public async listMethods(userId: string): Promise<AuthMethodInterface[]> {
    return this.userService.findMethodsByUserId(userId);
  }

  public async addEmailMethod(userId: string, email: string, password: string): Promise<void> {
    const methods: AuthMethodInterface[] = await this.userService.findMethodsByUserId(userId);

    if (
      methods.some(
        (method: AuthMethodInterface): boolean => method.type === AuthMethodTypeEnum.EMAIL,
      )
    ) {
      throw new ConflictError(AUTH_METHOD_ALREADY_LINKED);
    }

    await this.assertEmailFreeForUser(userId, email);
    await this.userService.addEmailMethod(userId, email, await hash(password, ARGON2_OPTIONS));
    await this.emailFlowService.requestEmailVerification(userId);
    this.logger.log(`Email method added for user ${userId}`);
    this.eventBus.emit(AUTH_METHOD_LINKED_EVENT, {
      userId,
      type: AuthMethodTypeEnum.EMAIL,
    });
  }

  public async unlinkMethod(userId: string, type: AuthMethodTypeEnum): Promise<void> {
    const methods: AuthMethodInterface[] = await this.userService.findMethodsByUserId(userId);
    const target: AuthMethodInterface | undefined = methods.find(
      (method: AuthMethodInterface): boolean => method.type === type,
    );

    if (!target) throw new NotFoundError(AUTH_METHOD_NOT_FOUND);

    // The account must always keep at least one way in.
    if (methods.length <= 1) throw new ConflictError(AUTH_LAST_METHOD);

    await this.userService.removeMethod(userId, type);
  }

  // The user's own oauth method may carry this email — that is the expected
  // add-password flow, not a conflict. Only other accounts block it.
  private async assertEmailFreeForUser(userId: string, email: string): Promise<void> {
    const emailMethod: AuthMethodInterface | null = await this.userService.findEmailMethod(email);

    if (emailMethod && emailMethod.userId !== userId) {
      const methods: AuthMethodInterface[] = await this.userService.findMethodsByUserId(
        emailMethod.userId,
      );

      throw new ConflictError({
        ...AUTH_EMAIL_LINKED_TO_OTHER_ACCOUNT,
        meta: { providers: methods.map((method: AuthMethodInterface): string => method.type) },
      });
    }

    const owner: UserWithMethodTypesInterface | null =
      await this.userService.findByAuthEmail(email);

    if (owner && owner.id !== userId) {
      throw new ConflictError({
        ...AUTH_EMAIL_LINKED_TO_OTHER_ACCOUNT,
        meta: { providers: owner.methodTypes },
      });
    }
  }
}
