import type { NotificationContentInterface } from '@modules/notification/interfaces/notification-content.interface.js';
import type { WebhookFailedPayloadInterface } from '@modules/notification/interfaces/webhook-failed-payload.interface.js';

// Error messages are internal diagnostics (provider SDK / dispatch failures),
// never user input — capped only to keep the denormalized meta blob bounded.
const MAX_LAST_ERROR_LENGTH = 300;

// ADMIN audience — the row addresses the admin cohort, not a specific user.
export function buildWebhookFailedContent(
  payload: WebhookFailedPayloadInterface,
): NotificationContentInterface {
  return {
    title: 'Webhook processing failed',
    body: `A ${payload.provider} webhook (${payload.type}) failed after ${payload.attempts} attempt(s).`,
    meta: {
      webhookEventId: payload.webhookEventId,
      provider: payload.provider,
      type: payload.type,
      attempts: payload.attempts,
      lastError: payload.lastError?.slice(0, MAX_LAST_ERROR_LENGTH) ?? null,
    },
  };
}
