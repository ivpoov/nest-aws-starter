import { validateScheme } from '@helpers/validate-scheme.helper.js';
import { Logger } from '@nestjs/common';
import { registerAs } from '@nestjs/config';
import { z } from 'zod';

// Unlike sqs.config.ts (region/endpoint, provider-wide), the webhook queue
// URL is this module's own resource. Not gated behind SQS_ENABLED: enqueue
// failures never fail the ingest request (see WebhookIngestService's enqueue
// catch site) — an empty/misconfigured URL just degrades to "logged and
// skipped" instead of a boot failure, same resilience posture as the rest of
// the ingest flow.
//
// consumerEnabled: opt-out, not opt-in (mirrors scheduler.config.ts) — the
// long-poll loop defaults on everywhere except e2e, where suites drive
// PaymentWebhookConsumerService.processMessage() directly for determinism
// instead of racing the loop's own poll interval.
const scheme = z.object({
  webhookQueueUrl: z.string(),
  consumerEnabled: z.boolean(),
});

export type PaymentConfig = z.infer<typeof scheme>;

export const paymentConfig = registerAs('payment', (): PaymentConfig => {
  const config: PaymentConfig = {
    webhookQueueUrl: process.env.SQS_PAYMENT_WEBHOOK_QUEUE_URL ?? '',
    consumerEnabled: process.env.PAYMENT_WEBHOOK_CONSUMER_ENABLED !== 'false',
  };

  validateScheme(scheme, config, new Logger('PaymentConfig'));

  return config;
});
