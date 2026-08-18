// Codes emitted by modules that are not optional and own no other wire
// surface, so they have nowhere module-specific to live: authorization
// refusals from the CASL guard, and the admin statistics gate.
export const COMMON_ERROR_CODES = [
  'CASL_FORBIDDEN',
  'ADMIN_IMPERSONATION_FORBIDDEN',
  'STATISTIC_REVENUE_UNAVAILABLE',
] as const;
