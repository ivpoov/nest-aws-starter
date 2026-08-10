import { ApiDefaultResponse } from '@decorators/api-default-response.decorator.js';
import { CurrentSessionId } from '@decorators/current-session-id.decorator.js';
import { CurrentUserId } from '@decorators/current-user-id.decorator.js';
import { Public } from '@decorators/public.decorator.js';
import { Serialize } from '@decorators/serialize.decorator.js';
import { ChangePasswordDto } from '@modules/auth/dtos/change-password.dto.js';
import { ForgotPasswordDto } from '@modules/auth/dtos/forgot-password.dto.js';
import { LoginDto } from '@modules/auth/dtos/login.dto.js';
import { RefreshDto } from '@modules/auth/dtos/refresh.dto.js';
import { RegisterDto } from '@modules/auth/dtos/register.dto.js';
import { ResetPasswordDto } from '@modules/auth/dtos/reset-password.dto.js';
import { AuthTokensResponseDto } from '@modules/auth/dtos/responses/auth-tokens-response.dto.js';
import { VerifyEmailDto } from '@modules/auth/dtos/verify-email.dto.js';
import { AuthService } from '@modules/auth/services/auth.service.js';
import { EmailFlowService } from '@modules/auth/services/email-flow.service.js';
import type { SessionContextInterface } from '@modules/session/interfaces/session-context.interface.js';
import type { TokenPairInterface } from '@modules/token/interfaces/token-pair.interface.js';
import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { FastifyRequest } from 'fastify';
import { StatusCodes } from 'http-status-codes';

// @ApiBearerAuth() is applied per handler here rather than on the class, which
// is the opposite of every other controller in this codebase. Most of this
// controller is @Public() — register, login, refresh and the three token-in-body
// email flows are reachable without an identity — so a class-level decorator
// would tell the reader that endpoints requiring no credential require one. The
// three handlers below that DO sit behind the global JwtAuthGuard carry it
// individually.
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly emailFlowService: EmailFlowService,
  ) {}

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

  @ApiBearerAuth()
  @ApiDefaultResponse({ status: StatusCodes.NO_CONTENT })
  @HttpCode(StatusCodes.NO_CONTENT)
  @Post('logout')
  public logout(
    @CurrentUserId() userId: string,
    @CurrentSessionId() sessionId: string,
  ): Promise<void> {
    return this.authService.logout(userId, sessionId);
  }

  @ApiBearerAuth()
  @ApiDefaultResponse({ status: StatusCodes.NO_CONTENT })
  @HttpCode(StatusCodes.NO_CONTENT)
  @Post('email/verify-request')
  public requestEmailVerification(@CurrentUserId() userId: string): Promise<void> {
    return this.emailFlowService.requestEmailVerification(userId);
  }

  // Public: the user may open the link in a browser without a session
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiDefaultResponse({ status: StatusCodes.NO_CONTENT })
  @HttpCode(StatusCodes.NO_CONTENT)
  @Post('email/verify')
  public verifyEmail(@Body() dto: VerifyEmailDto): Promise<void> {
    return this.emailFlowService.verifyEmail(dto.userId, dto.token);
  }

  // Public + always 204: no account enumeration
  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiDefaultResponse({ status: StatusCodes.NO_CONTENT })
  @HttpCode(StatusCodes.NO_CONTENT)
  @Post('password/forgot')
  public forgotPassword(@Body() dto: ForgotPasswordDto): Promise<void> {
    return this.emailFlowService.requestPasswordReset(dto.email);
  }

  // Public: the reset token is the credential
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiDefaultResponse({ status: StatusCodes.NO_CONTENT })
  @HttpCode(StatusCodes.NO_CONTENT)
  @Post('password/reset')
  public resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    return this.emailFlowService.resetPassword(dto.userId, dto.token, dto.password);
  }

  @ApiBearerAuth()
  @ApiDefaultResponse({ status: StatusCodes.NO_CONTENT })
  @HttpCode(StatusCodes.NO_CONTENT)
  @Post('password/change')
  public changePassword(
    @CurrentUserId() userId: string,
    @CurrentSessionId() sessionId: string,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    return this.emailFlowService.changePassword(
      userId,
      sessionId,
      dto.currentPassword,
      dto.password,
    );
  }

  private contextOf(request: FastifyRequest): SessionContextInterface {
    return {
      userAgent: request.headers['user-agent'] ?? null,
      ip: request.ip,
    };
  }
}
