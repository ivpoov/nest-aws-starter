import type { SubscriptionInterface } from '@modules/payment/interfaces/subscription.interface.js';

// Mirrors UpsertWebhookEventResultInterface's shape: createFromCheckout's
// P2002 catch (unique [provider, providerRef]) can't tell the caller "this
// row already existed" on its own — this explicit isNew flag is what lets
// SubscriptionLifecycleService skip re-emitting SUBSCRIPTION_ACTIVATED on a
// replayed webhook delivery.
export interface CreateSubscriptionResultInterface {
  readonly subscription: SubscriptionInterface;
  readonly isNew: boolean;
}
