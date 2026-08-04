import { ApiDefaultResponse } from '@decorators/api-default-response.decorator.js';
import { Serialize } from '@decorators/serialize.decorator.js';
import { AdminScope } from '@modules/casl/decorators/admin-scope.decorator.js';
import { UseAbility } from '@modules/casl/decorators/use-ability.decorator.js';
import { ActionsEnum } from '@modules/casl/enums/actions.enum.js';
import { AccessGuard } from '@modules/casl/guards/access.guard.js';
import { LockoutListResponseDto } from '@modules/suspicious-activity/dtos/responses/lockout-list-response.dto.js';
import { LockoutEntity } from '@modules/suspicious-activity/entities/lockout.entity.js';
import type { LockoutInterface } from '@modules/suspicious-activity/interfaces/lockout.interface.js';
import { LoginLockoutService } from '@modules/suspicious-activity/services/login-lockout.service.js';
import { Controller, Delete, Get, HttpCode, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { StatusCodes } from 'http-status-codes';

@ApiBearerAuth()
@ApiTags('Admin suspicious activity')
@UseGuards(AccessGuard)
@AdminScope()
@Controller('admin/suspicious/lockouts')
export class SuspiciousActivityAdminController {
  constructor(private readonly loginLockoutService: LoginLockoutService) {}

  @ApiDefaultResponse({ status: StatusCodes.OK, type: LockoutListResponseDto })
  @Serialize(LockoutListResponseDto)
  @UseAbility(ActionsEnum.READ, LockoutEntity)
  @Get()
  public async findMany(): Promise<{ items: LockoutInterface[] }> {
    const items: LockoutInterface[] = await this.loginLockoutService.listLockouts();

    return { items };
  }

  // :key is the base64url of "SCOPE:value" — opaque and URL-safe, so an IP or
  // email (which may itself contain '/' or '@') never needs its own encoding.
  @ApiDefaultResponse({ status: StatusCodes.NO_CONTENT })
  @UseAbility(ActionsEnum.DELETE, LockoutEntity)
  @HttpCode(StatusCodes.NO_CONTENT)
  @Delete(':key')
  public release(@Param('key') key: string): Promise<void> {
    return this.loginLockoutService.release(key);
  }
}
