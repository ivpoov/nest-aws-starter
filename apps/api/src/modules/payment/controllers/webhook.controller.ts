import { ApiDefaultResponse } from '@decorators/api-default-response.decorator.js';
import { Public } from '@decorators/public.decorator.js';
import { WebhookIngestService } from '@modules/payment/services/webhook-ingest.service.js';
import {
  Controller,
  Headers,
  HttpCode,
  Param,
  Post,
  type RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { FastifyRequest } from 'fastify';
import { StatusCodes } from 'http-status-codes';

// Public: providers call this unauthenticated — verifyAndParseWebhook's
// signature check is the trust boundary, not a session/bearer token.
@Public()
// Generous IP budget (not throttled by user — there is no user) so a burst
// of legitimate provider retries never trips a 429; 120/min per source IP.
@Throttle({ default: { limit: 120, ttl: 60_000 } })
@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhookController {
  constructor(private readonly webhookIngestService: WebhookIngestService) {}

  @ApiDefaultResponse({ status: StatusCodes.OK })
  @HttpCode(StatusCodes.OK)
  @Post(':provider')
  public ingest(
    @Param('provider') provider: string,
    // Only Stripe exists today, so the header name is hardcoded here rather
    // than resolved per-provider. A second provider needs this to become a
    // lookup (e.g. a `signatureHeader` field on PaymentProviderInterface).
    @Headers('stripe-signature') signature: string | undefined,
    @Req() request: RawBodyRequest<FastifyRequest>,
  ): Promise<void> {
    const rawBody: Buffer = request.rawBody ?? Buffer.alloc(0);

    return this.webhookIngestService.ingest(provider, rawBody, signature ?? '');
  }
}
