import { validateScheme } from '@helpers/validate-scheme.helper.js';
import { Logger } from '@nestjs/common';
import { registerAs } from '@nestjs/config';
import { z } from 'zod';

// Pinned to stripe@22.3.0's default (Stripe.LatestApiVersion) — not
// operator-configurable via env. The installed SDK's request/response types
// are generated for exactly this version; letting an env var override it
// would silently desync the runtime payloads from the types checking them.
const STRIPE_API_VERSION = '2026-06-24.dahlia' as const;

const scheme = z.discriminatedUnion('isEnabled', [
  z.object({ isEnabled: z.literal(false) }),
  z.object({
    isEnabled: z.literal(true),
    secretKey: z.string().min(1),
    webhookSecret: z.string().min(1),
    apiVersion: z.literal(STRIPE_API_VERSION),
    // Base URL Checkout redirects back to — `/billing/success` and
    // `/billing/canceled` are appended by the provider (Task 9 web routes).
    portalReturnUrl: z.url(),
  }),
]);

export type StripeConfig = z.infer<typeof scheme>;

export const stripeConfig = registerAs('stripe', (): StripeConfig => {
  const isEnabled: boolean = process.env.STRIPE_ENABLED === 'true';

  const config: StripeConfig = isEnabled
    ? {
        isEnabled: true,
        secretKey: process.env.STRIPE_SECRET_KEY ?? '',
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
        apiVersion: STRIPE_API_VERSION,
        portalReturnUrl: process.env.STRIPE_PORTAL_RETURN_URL ?? '',
      }
    : { isEnabled: false };

  validateScheme(scheme, config, new Logger('StripeConfig'));

  return config;
});
