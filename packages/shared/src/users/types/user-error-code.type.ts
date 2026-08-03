import type { USER_ERROR_CODES } from '../constants/user-error-codes.constants.js';

export type UserErrorCodeType = (typeof USER_ERROR_CODES)[number];
