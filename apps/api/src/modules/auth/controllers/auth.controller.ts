import { ApiDefaultResponse } from '@decorators/api-default-response.decorator.js';
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
import type { FastifyRequest } from 'fastify';
import { StatusCodes } from 'http-status-codes';

// Register/login/refresh are public by nature; the global auth guard (next PR)
// marks them @Public explicitly. Logout ships with the guard — it needs the
// authenticated session identity.
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiDefaultResponse({ status: StatusCodes.CREATED, type: AuthTokensResponseDto })
  @Serialize(AuthTokensResponseDto)
  @Post('register')
  public register(
    @Body() dto: RegisterDto,
    @Req() request: FastifyRequest,
  ): Promise<TokenPairInterface> {
    return this.authService.register(dto, this.contextOf(request));
  }

  @ApiDefaultResponse({ status: StatusCodes.OK, type: AuthTokensResponseDto })
  @Serialize(AuthTokensResponseDto)
  @HttpCode(StatusCodes.OK)
  @Post('login')
  public login(@Body() dto: LoginDto, @Req() request: FastifyRequest): Promise<TokenPairInterface> {
    return this.authService.login(dto, this.contextOf(request));
  }

  @ApiDefaultResponse({ status: StatusCodes.OK, type: AuthTokensResponseDto })
  @Serialize(AuthTokensResponseDto)
  @HttpCode(StatusCodes.OK)
  @Post('refresh')
  public refresh(@Body() dto: RefreshDto): Promise<TokenPairInterface> {
    return this.authService.refresh(dto.refreshToken);
  }

  private contextOf(request: FastifyRequest): SessionContextInterface {
    return {
      userAgent: request.headers['user-agent'] ?? null,
      ip: request.ip,
    };
  }
}
