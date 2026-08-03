import { ApiDefaultResponse } from '@decorators/api-default-response.decorator.js';
import { CurrentUserId } from '@decorators/current-user-id.decorator.js';
import { Serialize } from '@decorators/serialize.decorator.js';
import { UseAbility } from '@modules/casl/decorators/use-ability.decorator.js';
import { ActionsEnum } from '@modules/casl/enums/actions.enum.js';
import { AccessGuard } from '@modules/casl/guards/access.guard.js';
import { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
import { RevokedSessionsResponseDto } from '@modules/session/dtos/responses/revoked-sessions-response.dto.js';
import { SessionResponseDto } from '@modules/session/dtos/responses/session-response.dto.js';
import type { SessionForUserInterface } from '@modules/session/interfaces/session-for-user.interface.js';
import { SessionService } from '@modules/session/services/session.service.js';
import { AdminUsersQueryDto } from '@modules/user/dtos/admin-users-query.dto.js';
import { AdminUserListResponseDto } from '@modules/user/dtos/responses/admin-user-list-response.dto.js';
import { AdminUserResponseDto } from '@modules/user/dtos/responses/admin-user-response.dto.js';
import { UserEntity } from '@modules/user/entities/user.entity.js';
import type { AdminUserInterface } from '@modules/user/interfaces/admin-user.interface.js';
import { UserService } from '@modules/user/services/user.service.js';
import { Controller, Delete, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { StatusCodes } from 'http-status-codes';

@ApiBearerAuth()
@ApiTags('Admin users')
@UseGuards(AccessGuard)
@Controller('admin/users')
export class UserAdminController {
  private readonly logger = new CustomLoggerService(UserAdminController.name);

  constructor(
    private readonly userService: UserService,
    private readonly sessionService: SessionService,
  ) {}

  @ApiDefaultResponse({ status: StatusCodes.OK, type: AdminUserListResponseDto })
  @Serialize(AdminUserListResponseDto)
  @UseAbility(ActionsEnum.READ, UserEntity)
  @Get()
  public async findMany(@Query() query: AdminUsersQueryDto): Promise<{
    items: AdminUserInterface[];
    nextCursor: string | null;
  }> {
    const items: AdminUserInterface[] = await this.userService.findManyForAdmin({
      limit: query.limit,
      cursor: query.cursor,
      search: query.search,
    });
    const lastItem: AdminUserInterface | undefined = items[items.length - 1];

    return {
      items,
      nextCursor: items.length === query.limit && lastItem ? lastItem.id : null,
    };
  }

  @ApiDefaultResponse({ status: StatusCodes.OK, type: AdminUserResponseDto })
  @Serialize(AdminUserResponseDto)
  @UseAbility(ActionsEnum.READ, UserEntity)
  @Get(':id')
  public findById(@Param('id', ParseUUIDPipe) id: string): Promise<AdminUserInterface> {
    return this.userService.findByIdForAdminOrThrow(id);
  }

  @ApiDefaultResponse({ status: StatusCodes.OK, type: SessionResponseDto, isArray: true })
  @Serialize(SessionResponseDto)
  @UseAbility(ActionsEnum.READ, UserEntity)
  @Get(':id/sessions')
  public async findSessions(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SessionForUserInterface[]> {
    await this.userService.findByIdForAdminOrThrow(id);

    return this.sessionService.listSessions(id, '');
  }

  @ApiDefaultResponse({ status: StatusCodes.OK, type: RevokedSessionsResponseDto })
  @Serialize(RevokedSessionsResponseDto)
  @UseAbility(ActionsEnum.MANAGE, UserEntity)
  @Delete(':id/sessions')
  public async revokeSessions(
    @CurrentUserId() adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ revokedCount: number }> {
    await this.userService.findByIdForAdminOrThrow(id);

    const revokedCount: number = await this.sessionService.revokeAllForUser(id);

    this.logger.log(`Admin ${adminId} force-logged-out user ${id} (${revokedCount} sessions)`);

    return { revokedCount };
  }
}
