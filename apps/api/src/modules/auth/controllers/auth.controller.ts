import { ApiDefaultResponse } from '@decorators/api-default-response.decorator.js';
import { CurrentSessionId } from '@decorators/current-session-id.decorator.js';
import { CurrentUserId } from '@decorators/current-user-id.decorator.js';
import { Public } from '@decorators/public.decorator.js';
import { Serialize } from '@decorators/serialize.decorator.js';
import { LoginDto } from '@modules/auth/dtos/login.dto.js';
import { RefreshDto } from '@modules/auth/dtos/refresh.dto.js';
import { RegisterDto } from '@modules/auth/dtos/register.dto.js';
import { AuthTokensResponseDto } from '@modules/auth/dtos/responses/auth-tokens-response.dto.js';
import { AuthService } from '@modules/auth/services/auth.service.js';
import type { SessionContextInterface } from '@modules/session/interfaces/session-context.interface.js';
import type { TokenPairInterface } from '@modules/token/interfaces/token-pair.interface.js';
import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { FastifyRequest } from 'fastify';
import { StatusCodes } from 'http-status-codes';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Public: account creation happens before any identity exists
  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiDefaultResponse({ status: StatusCodes.CREATED, type: AuthTokensResponseDto })
  @Serialize(AuthTokensResponseDto)
  @Post('register')
  public register(
    @Body() dto: RegisterDto,
    @Req() request: FastifyRequest,
  ): Promise<TokenPairInterface> {
    return this.authService.register(dto, this.contextOf(request));
  }

  // Public: credentials are the authentication
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiDefaultResponse({ status: StatusCodes.OK, type: AuthTokensResponseDto })
  @Serialize(AuthTokensResponseDto)
  @HttpCode(StatusCodes.OK)
  @Post('login')
  public login(@Body() dto: LoginDto, @Req() request: FastifyRequest): Promise<TokenPairInterface> {
    return this.authService.login(dto, this.contextOf(request));
  }

  // Public: the refresh token itself is the credential
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiDefaultResponse({ status: StatusCodes.OK, type: AuthTokensResponseDto })
  @Serialize(AuthTokensResponseDto)
  @HttpCode(StatusCodes.OK)
  @Post('refresh')
  public refresh(@Body() dto: RefreshDto): Promise<TokenPairInterface> {
    return this.authService.refresh(dto.refreshToken);
  }

  @ApiDefaultResponse({ status: StatusCodes.NO_CONTENT })
  @HttpCode(StatusCodes.NO_CONTENT)
  @Post('logout')
  public logout(
    @CurrentUserId() userId: string,
    @CurrentSessionId() sessionId: string,
  ): Promise<void> {
    return this.authService.logout(userId, sessionId);
  }

  private contextOf(request: FastifyRequest): SessionContextInterface {
    return {
      userAgent: request.headers['user-agent'] ?? null,
      ip: request.ip,
    };
  }
}
