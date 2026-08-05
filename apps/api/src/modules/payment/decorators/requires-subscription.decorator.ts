import { REQUIRES_SUBSCRIPTION_METADATA_KEY } from '@modules/payment/constants/requires-subscription.constants.js';
import { SetMetadata } from '@nestjs/common';

// Marks a route as requiring SubscriptionService.hasActiveSubscription() —
// paired with RequiresSubscriptionGuard. Not used by any production
// controller in this starter (payments are demonstrated, not enforced) —
// see test/subscription-access.e2e-spec.ts for the demo route that proves
// 403-without/200-with.
export function RequiresSubscription(): MethodDecorator {
  return SetMetadata(REQUIRES_SUBSCRIPTION_METADATA_KEY, true);
}
