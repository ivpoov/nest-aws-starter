import type { AUTH_ERROR_CODES } from '../constants/auth-error-codes.constants.js';

export type AuthErrorCodeType = (typeof AUTH_ERROR_CODES)[number];
