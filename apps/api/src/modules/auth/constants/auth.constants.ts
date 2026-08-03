import { argon2id } from 'argon2';

// OWASP baseline for argon2id — constants by design, not env vars.
export const ARGON2_OPTIONS = {
  type: argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;
