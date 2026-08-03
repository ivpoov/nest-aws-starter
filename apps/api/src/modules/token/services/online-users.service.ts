import { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
import { ONLINE_USERS_REPOSITORY } from '@modules/token/constants/token.constants.js';
import type { OnlineUsersRepositoryInterface } from '@modules/token/interfaces/online-users-repository.interface.js';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class OnlineUsersService {
  private readonly logger = new CustomLoggerService(OnlineUsersService.name);

  constructor(
    @Inject(ONLINE_USERS_REPOSITORY)
    private readonly onlineUsersRepository: OnlineUsersRepositoryInterface,
  ) {}

  // Called from the JWT guard on every authenticated request — presence is a
  // best-effort gauge, never a reason to fail a request, so failures are
  // swallowed here rather than left for callers to remember to catch.
  public async touch(userId: string): Promise<void> {
    try {
      await this.onlineUsersRepository.touch(userId);
    } catch (error) {
      this.logger.warn(`Failed to record presence for user ${userId}: ${(error as Error).message}`);
    }
  }

  public countActive(windowSec: number): Promise<number> {
    return this.onlineUsersRepository.countActive(windowSec);
  }
}
