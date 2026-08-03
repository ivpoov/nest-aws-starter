import { argon2id } from 'argon2';

// OWASP baseline for argon2id — constants by design, not env vars.
export const ARGON2_OPTIONS = {
  type: argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export const ONE_TIME_TOKEN_REPOSITORY = Symbol('ONE_TIME_TOKEN_REPOSITORY');

export const VERIFY_EMAIL_TTL_SEC = 86_400;
export const RESET_PASSWORD_TTL_SEC = 3_600;
