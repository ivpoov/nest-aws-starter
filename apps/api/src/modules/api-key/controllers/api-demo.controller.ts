import { ApiDefaultResponse } from '@decorators/api-default-response.decorator.js';
import { Serialize } from '@decorators/serialize.decorator.js';
import { API_KEY_THROTTLER_NAME } from '@modules/api-key/constants/api-key.constants.js';
import { CurrentApiKey } from '@modules/api-key/decorators/current-api-key.decorator.js';
import { RequireApiKey } from '@modules/api-key/decorators/require-api-key.decorator.js';
import { ApiDemoWhoamiResponseDto } from '@modules/api-key/dtos/responses/api-demo-whoami-response.dto.js';
import { ApiKeyThrottlerGuard } from '@modules/api-key/guards/api-key-throttler.guard.js';
import type { ApiKeyPrincipalInterface } from '@modules/api-key/interfaces/api-key-principal.interface.js';
import type { ApiDemoWhoamiResponseInterface } from '@nest-aws-starter/shared';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { StatusCodes } from 'http-status-codes';

// Starter reference implementation: the ONE example of an API-key-guarded
// endpoint in this codebase, showing the full composition pattern —
// @RequireApiKey() (Public() + ApiKeyGuard) plus the per-key rate budget
// (ApiKeyThrottlerGuard). Copy this shape for real service-to-service
// endpoints.
@ApiTags('API keys')
@ApiHeader({ name: 'X-Api-Key', description: 'API key issued by an admin', required: true })
@Controller('api-demo')
export class ApiDemoController {
  // Guard order is load-bearing, not stylistic: @RequireApiKey() is written
  // closer to the handler than @UseGuards(ApiKeyThrottlerGuard), so it is
  // *applied* first (TS decorators apply bottom-up) and its ApiKeyGuard
  // therefore lands first in the resulting guards array — request.apiKey is
  // attached before ApiKeyThrottlerGuard.getTracker() runs and needs it.
  // Swapping the order silently falls back to ip-based throttling instead
  // of per-key. The 429/200 assertions in api-keys.e2e-spec.ts are the
  // actual proof this order is correct, not just the comment.
  @Throttle({ [API_KEY_THROTTLER_NAME]: { limit: 3, ttl: 60_000 } })
  @ApiDefaultResponse({ status: StatusCodes.OK, type: ApiDemoWhoamiResponseDto })
  @Serialize(ApiDemoWhoamiResponseDto)
  @UseGuards(ApiKeyThrottlerGuard)
  @RequireApiKey()
  @Get('whoami')
  public whoami(@CurrentApiKey() apiKey: ApiKeyPrincipalInterface): ApiDemoWhoamiResponseInterface {
    return { keyName: apiKey.name };
  }
}
