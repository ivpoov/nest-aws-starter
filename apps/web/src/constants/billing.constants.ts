// Mirrors PAYMENT_NO_SUBSCRIPTION from
// apps/api/src/modules/payment/constants/payment-errors.constants.ts —
// packages/shared only ships the code union (PaymentErrorCodeType), not
// per-code constants, so the FE names the one code it branches on directly.
export const PAYMENT_NO_SUBSCRIPTION_CODE = 'PAYMENT_NO_SUBSCRIPTION';

// apps/api/src/modules/payment/constants/payment-errors.constants.ts —
// rendered as a friendly "payments not configured" note on the pricing page.
export const PAYMENT_PROVIDER_NOT_ENABLED_CODE = 'PAYMENT_PROVIDER_NOT_ENABLED';
