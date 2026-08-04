import type { WebhookEventInterface } from '@modules/payment/interfaces/webhook-event.interface.js';

// create() can't tell you "this row already existed" directly — the
// repository's P2002 catch (see webhook-event-prisma.repository.ts) is what
// turns that into this explicit isNew flag the service branches on.
export interface UpsertWebhookEventResultInterface {
  readonly event: WebhookEventInterface;
  readonly isNew: boolean;
}
