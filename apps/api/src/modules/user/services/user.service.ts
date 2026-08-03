import { ConflictError } from '@modules/common/errors/conflict.error.js';
import { ForbiddenError } from '@modules/common/errors/forbidden.error.js';
import { NotFoundError } from '@modules/common/errors/not-found.error.js';
import {
  USER_BLOCKED_EVENT,
  USER_UNBLOCKED_EVENT,
} from '@modules/event/constants/event-names.constants.js';
import { EventBusService } from '@modules/event/services/event-bus.service.js';
import { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
import { USER_REPOSITORY } from '@modules/user/constants/user.constants.js';
import {
  ADMIN_CANNOT_IMPERSONATE_ADMIN,
  USER_BLOCKED,
  USER_CANNOT_BLOCK_SELF,
  USER_NOT_FOUND,
} from '@modules/user/constants/user-errors.constants.js';
import type { AdminUserInterface } from '@modules/user/interfaces/admin-user.interface.js';
import type { AdminUsersQueryInterface } from '@modules/user/interfaces/admin-users-query.interface.js';
import type { AuthMethodInterface } from '@modules/user/interfaces/auth-method.interface.js';
import type { CreateEmailUserDataInterface } from '@modules/user/interfaces/create-email-user-data.interface.js';
import type { CreateOauthMethodDataInterface } from '@modules/user/interfaces/create-oauth-method-data.interface.js';
import type { CreateOauthUserDataInterface } from '@modules/user/interfaces/create-oauth-user-data.interface.js';
import type { UpdateProfileDataInterface } from '@modules/user/interfaces/update-profile-data.interface.js';
import type { UserInterface } from '@modules/user/interfaces/user.interface.js';
import type { UserRepositoryInterface } from '@modules/user/interfaces/user-repository.interface.js';
import type { UserWithMethodTypesInterface } from '@modules/user/interfaces/user-with-method-types.interface.js';
import { UserRoleEnum, UserStatusEnum } from '@nest-aws-starter/shared';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class UserService {
  private readonly logger = new CustomLoggerService(UserService.name);

  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryInterface,
    private readonly eventBus: EventBusService,
  ) {}

  public async createWithEmailMethod(data: CreateEmailUserDataInterface): Promise<UserInterface> {
    const user: UserInterface = await this.userRepository.createWithEmailMethod(data);

    this.logger.log(`User created with email method: ${user.id}`);

    return user;
  }

  public async createWithOauthMethod(data: CreateOauthUserDataInterface): Promise<UserInterface> {
    const user: UserInterface = await this.userRepository.createWithOauthMethod(data);

    this.logger.log(`User created with ${data.type} method: ${user.id}`);

    return user;
  }

  public async findByIdOrThrow(id: string): Promise<UserInterface> {
    const user: UserInterface | null = await this.userRepository.findById(id);

    if (!user) throw new NotFoundError(USER_NOT_FOUND);

    return user;
  }

  public async findByAuthEmail(email: string): Promise<UserWithMethodTypesInterface | null> {
    return this.userRepository.findByAuthEmail(email);
  }

  public async findEmailMethod(email: string): Promise<AuthMethodInterface | null> {
    return this.userRepository.findEmailMethodByEmail(email);
  }

  public async findMethodByProviderAccount(
    type: CreateOauthMethodDataInterface['type'],
    providerAccountId: string,
  ): Promise<AuthMethodInterface | null> {
    return this.userRepository.findMethodByProviderAccount(type, providerAccountId);
  }

  public async addOauthMethod(userId: string, data: CreateOauthMethodDataInterface): Promise<void> {
    await this.userRepository.addOauthMethod(userId, data);
    this.logger.log(`Linked ${data.type} method to user ${userId}`);
  }

  public async addEmailMethod(userId: string, email: string, passwordHash: string): Promise<void> {
    await this.userRepository.addEmailMethod(userId, email, passwordHash);
    this.logger.log(`Linked EMAIL method to user ${userId}`);
  }

  public async findManyForAdmin(query: AdminUsersQueryInterface): Promise<AdminUserInterface[]> {
    return this.userRepository.findManyForAdmin(query);
  }

  public async findByIdForAdminOrThrow(id: string): Promise<AdminUserInterface> {
    const user: AdminUserInterface | null = await this.userRepository.findByIdForAdmin(id);

    if (!user) throw new NotFoundError(USER_NOT_FOUND);

    return user;
  }

  public async findMethodsByUserId(userId: string): Promise<AuthMethodInterface[]> {
    return this.userRepository.findMethodsByUserId(userId);
  }

  public async removeMethod(
    userId: string,
    type: CreateOauthMethodDataInterface['type'],
  ): Promise<boolean> {
    const isRemoved: boolean = await this.userRepository.removeMethod(userId, type);

    if (isRemoved) this.logger.log(`Unlinked ${type} method from user ${userId}`);

    return isRemoved;
  }

  public async findEmailMethodByUserId(userId: string): Promise<AuthMethodInterface | null> {
    return this.userRepository.findEmailMethodByUserId(userId);
  }

  public async markEmailVerified(methodId: string): Promise<void> {
    await this.userRepository.markEmailVerified(methodId);
    this.logger.log(`Email method verified: ${methodId}`);
  }

  public async updatePasswordHash(methodId: string, passwordHash: string): Promise<void> {
    await this.userRepository.updatePasswordHash(methodId, passwordHash);
    this.logger.log(`Password updated for method: ${methodId}`);
  }

  public async touchMethodLastUsed(methodId: string): Promise<void> {
    await this.userRepository.touchMethodLastUsed(methodId, new Date());
  }

  public async updateProfile(id: string, data: UpdateProfileDataInterface): Promise<UserInterface> {
    const user: UserInterface | null = await this.userRepository.updateProfile(id, data);

    if (!user) throw new NotFoundError(USER_NOT_FOUND);

    this.logger.log(`User profile updated: ${id}`);

    return user;
  }

  public async updateStatus(
    id: string,
    status: UserStatusEnum,
    actorId: string,
  ): Promise<UserInterface> {
    if (status === UserStatusEnum.BLOCKED) this.assertNotSelfBlock(id, actorId);

    const user: UserInterface | null = await this.userRepository.updateStatus(id, status);

    if (!user) throw new NotFoundError(USER_NOT_FOUND);

    this.logger.log(`User ${id} status set to ${status} by ${actorId}`);
    this.eventBus.emit(
      status === UserStatusEnum.BLOCKED ? USER_BLOCKED_EVENT : USER_UNBLOCKED_EVENT,
      { userId: id, actorId },
    );

    return user;
  }

  // Side-effect-free guard, called by the controller before it revokes
  // sessions (fail-safe ordering: never revoke a blocker's own live
  // sessions on a rejected self-block) and again here as the write path's
  // own defense in depth.
  public assertNotSelfBlock(id: string, actorId: string): void {
    if (id === actorId) throw new ConflictError(USER_CANNOT_BLOCK_SELF);
  }

  // Login-as gate: only USER-role, non-blocked targets can be impersonated —
  // never another admin (no privilege re-escalation) and never a blocked
  // account (nothing to legitimately investigate through a live session).
  public assertCanImpersonate(target: AdminUserInterface): void {
    if (target.role !== UserRoleEnum.USER) {
      throw new ForbiddenError(ADMIN_CANNOT_IMPERSONATE_ADMIN);
    }

    if (target.status === UserStatusEnum.BLOCKED) {
      throw new ForbiddenError(USER_BLOCKED);
    }
  }
}
