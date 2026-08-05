import type { PAYMENT_ERROR_CODES } from '../constants/payment-error-codes.constants.js';

export type PaymentErrorCodeType = (typeof PAYMENT_ERROR_CODES)[number];
