import { ApiDefaultResponse } from '@decorators/api-default-response.decorator.js';
import { CurrentUserId } from '@decorators/current-user-id.decorator.js';
import { Serialize } from '@decorators/serialize.decorator.js';
import { AdminScope } from '@modules/casl/decorators/admin-scope.decorator.js';
import { UseAbility } from '@modules/casl/decorators/use-ability.decorator.js';
import { ActionsEnum } from '@modules/casl/enums/actions.enum.js';
import { AccessGuard } from '@modules/casl/guards/access.guard.js';
import { ADMIN_LOGIN_AS_EVENT } from '@modules/event/constants/event-names.constants.js';
import { EventBusService } from '@modules/event/services/event-bus.service.js';
import { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
import { OauthFlowService } from '@modules/oauth/services/oauth-flow.service.js';
import { RevokedSessionsResponseDto } from '@modules/session/dtos/responses/revoked-sessions-response.dto.js';
import { SessionResponseDto } from '@modules/session/dtos/responses/session-response.dto.js';
import type { LoginAsSessionResultInterface } from '@modules/session/interfaces/login-as-session-result.interface.js';
import type { SessionContextInterface } from '@modules/session/interfaces/session-context.interface.js';
import type { SessionForUserInterface } from '@modules/session/interfaces/session-for-user.interface.js';
import { SessionService } from '@modules/session/services/session.service.js';
import { AdminUsersQueryDto } from '@modules/user/dtos/admin-users-query.dto.js';
import { AdminUserListResponseDto } from '@modules/user/dtos/responses/admin-user-list-response.dto.js';
import { AdminUserResponseDto } from '@modules/user/dtos/responses/admin-user-response.dto.js';
import { LoginAsResponseDto } from '@modules/user/dtos/responses/login-as-response.dto.js';
import { UpdateUserStatusDto } from '@modules/user/dtos/update-user-status.dto.js';
import { UserEntity } from '@modules/user/entities/user.entity.js';
import type { AdminUserInterface } from '@modules/user/interfaces/admin-user.interface.js';
import { UserService } from '@modules/user/services/user.service.js';
import { UserAdminService } from '@modules/user/services/user-admin.service.js';
import type { LoginAsResponseInterface } from '@nest-aws-starter/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { FastifyRequest } from 'fastify';
import { StatusCodes } from 'http-status-codes';

@ApiBearerAuth()
@ApiTags('Admin users')
@UseGuards(AccessGuard)
@AdminScope()
@Controller('admin/users')
export class UserAdminController {
  private readonly logger = new CustomLoggerService(UserAdminController.name);

  constructor(
    private readonly userService: UserService,
    private readonly userAdminService: UserAdminService,
    private readonly sessionService: SessionService,
    private readonly oauthFlowService: OauthFlowService,
    private readonly eventBus: EventBusService,
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

  @ApiDefaultResponse({ status: StatusCodes.OK, type: AdminUserResponseDto })
  @Serialize(AdminUserResponseDto)
  @UseAbility(ActionsEnum.UPDATE, UserEntity)
  @Patch(':id/status')
  public updateStatus(
    @CurrentUserId() adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserStatusDto,
  ): Promise<AdminUserInterface> {
    return this.userAdminService.updateStatus(adminId, id, dto.status, dto.reason);
  }

  // Sensitive like /auth/login: same throttle budget, and the AccessGuard's
  // actAsBy check keeps the resulting session from ever reaching this route
  // again — no nesting. Tokens never leave the API directly: a one-time
  // exchange code is minted and redeemed by the web app through the same
  // public /auth/oauth/exchange endpoint OAuth login already uses, so the
  // admin UI can open the web app in a new tab without tokens in the URL.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiDefaultResponse({ status: StatusCodes.CREATED, type: LoginAsResponseDto })
  @Serialize(LoginAsResponseDto)
  @UseAbility(ActionsEnum.MANAGE, UserEntity)
  @Post(':id/login-as')
  public async loginAs(
    @CurrentUserId() adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: FastifyRequest,
  ): Promise<LoginAsResponseInterface> {
    const target: AdminUserInterface = await this.userService.findByIdForAdminOrThrow(id);

    this.userService.assertCanImpersonate(target);

    const result: LoginAsSessionResultInterface =
      await this.sessionService.createImpersonatedSession(target, adminId, this.contextOf(request));
    const code: string = await this.oauthFlowService.mintExchangeCode(result.tokens);

    this.logger.log(`Admin ${adminId} logged in as user ${id} (session ${result.sessionId})`);
    this.eventBus.emit(ADMIN_LOGIN_AS_EVENT, {
      userId: id,
      actorId: adminId,
      sessionId: result.sessionId,
    });

    return { code };
  }

  private contextOf(request: FastifyRequest): SessionContextInterface {
    return { userAgent: request.headers['user-agent'] ?? null, ip: request.ip };
  }
}
