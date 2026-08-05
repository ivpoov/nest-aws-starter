import type { WebhookEventStatusEnum } from '@modules/payment/enums/webhook-event-status.enum.js';

export interface WebhookEventInterface {
  readonly id: string;
  readonly provider: string;
  readonly providerEventId: string;
  readonly type: string;
  readonly payload: Record<string, unknown>;
  readonly status: WebhookEventStatusEnum;
  readonly attempts: number;
  readonly lastError: string | null;
  readonly createdAt: Date;
  readonly processedAt: Date | null;
}
