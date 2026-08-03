import { ApiDefaultResponse } from '@decorators/api-default-response.decorator.js';
import { Public } from '@decorators/public.decorator.js';
import { Serialize } from '@decorators/serialize.decorator.js';
import { ValidationError } from '@modules/common/errors/validation.error.js';
import { OAUTH_PROVIDER_NOT_ENABLED } from '@modules/oauth/constants/oauth-errors.constants.js';
import { OauthCallbackQueryDto } from '@modules/oauth/dtos/oauth-callback-query.dto.js';
import { OauthExchangeDto } from '@modules/oauth/dtos/oauth-exchange.dto.js';
import { OauthStartQueryDto } from '@modules/oauth/dtos/oauth-start-query.dto.js';
import { OauthExchangeResponseDto } from '@modules/oauth/dtos/responses/oauth-exchange-response.dto.js';
import { OauthProvidersResponseDto } from '@modules/oauth/dtos/responses/oauth-providers-response.dto.js';
import type { OauthExchangePayloadInterface } from '@modules/oauth/interfaces/oauth-exchange-payload.interface.js';
import { OauthFlowService } from '@modules/oauth/services/oauth-flow.service.js';
import { OauthProviderRegistryService } from '@modules/oauth/services/oauth-provider-registry.service.js';
import type { SessionContextInterface } from '@modules/session/interfaces/session-context.interface.js';
import { AuthMethodTypeEnum, type OauthProvidersResponseInterface } from '@nest-aws-starter/shared';
import { Body, Controller, Get, HttpCode, Param, Post, Query, Redirect, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { FastifyRequest } from 'fastify';
import { StatusCodes } from 'http-status-codes';

@ApiTags('OAuth')
@Controller('auth')
export class OauthController {
  constructor(
    private readonly flowService: OauthFlowService,
    private readonly registry: OauthProviderRegistryService,
  ) {}

  // Public: the FE renders provider buttons before any session exists
  @Public()
  @ApiDefaultResponse({ status: StatusCodes.OK, type: OauthProvidersResponseDto })
  @Serialize(OauthProvidersResponseDto)
  @Get('providers')
  public listProviders(): OauthProvidersResponseInterface {
    return { providers: this.registry.enabledTypes() };
  }

  // Public: login starts unauthenticated; link intent carries a bearer header
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiDefaultResponse({ status: StatusCodes.MOVED_TEMPORARILY })
  @Redirect()
  @Get('oauth/:provider/start')
  public async start(
    @Param('provider') provider: string,
    @Query() query: OauthStartQueryDto,
    @Req() request: FastifyRequest,
  ): Promise<{ url: string; statusCode: number }> {
    const url: string = await this.flowService.start(
      this.parseProvider(provider),
      query.intent,
      query.redirect,
      request.headers.authorization,
    );

    return { url, statusCode: StatusCodes.MOVED_TEMPORARILY };
  }

  // Public: the provider redirects the user's browser here
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiDefaultResponse({ status: StatusCodes.MOVED_TEMPORARILY })
  @Redirect()
  @Get('oauth/:provider/callback')
  public async callback(
    @Param('provider') provider: string,
    @Query() query: OauthCallbackQueryDto,
    @Req() request: FastifyRequest,
  ): Promise<{ url: string; statusCode: number }> {
    const context: SessionContextInterface = {
      userAgent: request.headers['user-agent'] ?? null,
      ip: request.ip,
    };
    const url: string = await this.flowService.handleCallback(
      this.parseProvider(provider),
      query.state,
      query.code,
      context,
    );

    return { url, statusCode: StatusCodes.MOVED_TEMPORARILY };
  }

  // Public: the one-time exchange code is the credential
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiDefaultResponse({ status: StatusCodes.OK, type: OauthExchangeResponseDto })
  @Serialize(OauthExchangeResponseDto)
  @HttpCode(StatusCodes.OK)
  @Post('oauth/exchange')
  public exchange(@Body() dto: OauthExchangeDto): Promise<OauthExchangePayloadInterface> {
    return this.flowService.exchange(dto.code);
  }

  private parseProvider(raw: string): AuthMethodTypeEnum {
    const type: AuthMethodTypeEnum | undefined = Object.values(AuthMethodTypeEnum).find(
      (candidate: AuthMethodTypeEnum): boolean => candidate.toLowerCase() === raw.toLowerCase(),
    );

    if (!type || type === AuthMethodTypeEnum.EMAIL) {
      throw new ValidationError(OAUTH_PROVIDER_NOT_ENABLED);
    }

    return type;
  }
}
