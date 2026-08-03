import { ApiDefaultResponse } from '@decorators/api-default-response.decorator.js';
import { CurrentSessionId } from '@decorators/current-session-id.decorator.js';
import { CurrentUserId } from '@decorators/current-user-id.decorator.js';
import { Serialize } from '@decorators/serialize.decorator.js';
import { RevokedSessionsResponseDto } from '@modules/session/dtos/responses/revoked-sessions-response.dto.js';
import { SessionResponseDto } from '@modules/session/dtos/responses/session-response.dto.js';
import { RevokeSessionsQueryDto } from '@modules/session/dtos/revoke-sessions-query.dto.js';
import type { SessionForUserInterface } from '@modules/session/interfaces/session-for-user.interface.js';
import { SessionService } from '@modules/session/services/session.service.js';
import type { RevokedSessionsResponseInterface } from '@nest-aws-starter/shared';
import { Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { StatusCodes } from 'http-status-codes';

@ApiBearerAuth()
@ApiTags('Sessions')
@Controller('sessions')
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @ApiDefaultResponse({ status: StatusCodes.OK, type: SessionResponseDto, isArray: true })
  @Serialize(SessionResponseDto)
  @Get()
  public list(
    @CurrentUserId() userId: string,
    @CurrentSessionId() sessionId: string,
  ): Promise<SessionForUserInterface[]> {
    return this.sessionService.listSessions(userId, sessionId);
  }

  @ApiDefaultResponse({ status: StatusCodes.OK, type: RevokedSessionsResponseDto })
  @Serialize(RevokedSessionsResponseDto)
  @Delete()
  public async revokeMany(
    @CurrentUserId() userId: string,
    @CurrentSessionId() sessionId: string,
    @Query() query: RevokeSessionsQueryDto,
  ): Promise<RevokedSessionsResponseInterface> {
    const revokedCount: number = query.includeCurrent
      ? await this.sessionService.revokeAllForUser(userId)
      : await this.sessionService.revokeOtherSessions(userId, sessionId);

    return { revokedCount };
  }

  @ApiDefaultResponse({ status: StatusCodes.NO_CONTENT })
  @HttpCode(StatusCodes.NO_CONTENT)
  @Delete(':id')
  public revokeOne(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.sessionService.revokeSession(userId, id);
  }
}
