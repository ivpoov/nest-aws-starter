import type { StripeConfig } from '@configs/stripe.config.js';

export type EnabledStripeConfigType = Extract<StripeConfig, { isEnabled: true }>;
