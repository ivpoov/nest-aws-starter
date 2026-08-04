import { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
import { SessionService } from '@modules/session/services/session.service.js';
import type { AdminUserInterface } from '@modules/user/interfaces/admin-user.interface.js';
import type { UserInterface } from '@modules/user/interfaces/user.interface.js';
import { UserService } from '@modules/user/services/user.service.js';
import { UserStatusEnum } from '@nest-aws-starter/shared';
import { Injectable } from '@nestjs/common';

@Injectable()
export class UserAdminService {
  private readonly logger = new CustomLoggerService(UserAdminService.name);

  constructor(
    private readonly userService: UserService,
    private readonly sessionService: SessionService,
  ) {}

  public async updateStatus(
    adminId: string,
    id: string,
    status: UserStatusEnum,
    reason?: string,
  ): Promise<AdminUserInterface> {
    const existing: AdminUserInterface = await this.userService.findByIdForAdminOrThrow(id);

    // Fail-safe ordering: revoke sessions BEFORE flipping the status. If the
    // revoke throws, nothing has changed yet (status untouched, no event). If
    // the status write below fails after a successful revoke, the user is
    // left logged out but still ACTIVE — the safe direction, since it never
    // leaves a BLOCKED user with live sessions.
    if (status === UserStatusEnum.BLOCKED) {
      this.userService.assertNotSelfBlock(id, adminId);
      await this.sessionService.revokeAllForUser(id);
      this.logger.log(`Admin ${adminId} revoked all sessions for user ${id} before blocking`);
    }

    const updated: UserInterface = await this.userService.updateStatus(id, status, adminId, reason);

    // The write already returns the fresh row — merge it onto the admin-shaped
    // pre-check result instead of a second findByIdForAdminOrThrow round trip.
    // email/methodTypes are untouched by a status change.
    return { ...existing, ...updated };
  }
}
