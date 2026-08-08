import { DEVELOPMENT_DEFAULTS } from '@constants/development-defaults.constants.js';
import {
  PRODUCTION_DEVELOPMENT_DEFAULT,
  PRODUCTION_UNAUTHENTICATED_SWAGGER,
  PRODUCTION_UNSAFE_CORS_ORIGIN,
  PRODUCTION_WEAK_JWT_SECRET,
} from '@constants/production-guard-errors.constants.js';
import { estimateEntropyBits } from '@helpers/estimate-entropy-bits.helper.js';
import type { DevelopmentDefaultInterface } from '@interfaces/development-default.interface.js';
import type { ErrorArgsInterface } from '@interfaces/error-args.interface.js';

const MINIMUM_JWT_SECRET_BITS = 256;
const LOOPBACK_HOSTNAMES: readonly string[] = ['localhost', '127.0.0.1', '[::1]', '::1', '0.0.0.0'];

// Every check runs and every finding is reported, so a misconfigured deploy
// costs one round trip rather than one per mistake.
export function collectProductionViolations(env: NodeJS.ProcessEnv): ErrorArgsInterface[] {
  return [
    ...collectDevelopmentDefaults(env),
    ...collectWeakJwtSecret(env),
    ...collectUnsafeCorsOrigins(env),
    ...collectUnauthenticatedSwagger(env),
  ];
}

function collectDevelopmentDefaults(env: NodeJS.ProcessEnv): ErrorArgsInterface[] {
  return DEVELOPMENT_DEFAULTS.filter(
    (candidate: DevelopmentDefaultInterface): boolean =>
      env[candidate.variable] === candidate.value,
  ).map(
    (candidate: DevelopmentDefaultInterface): ErrorArgsInterface => ({
      code: PRODUCTION_DEVELOPMENT_DEFAULT.code,
      details: `${candidate.variable} still holds the development default shipped in .env.example — ${candidate.remedy}.`,
    }),
  );
}

function collectWeakJwtSecret(env: NodeJS.ProcessEnv): ErrorArgsInterface[] {
  const secret: string = env.AUTH_JWT_SECRET ?? '';
  const bits: number = estimateEntropyBits(secret);

  if (bits >= MINIMUM_JWT_SECRET_BITS) return [];

  return [
    {
      code: PRODUCTION_WEAK_JWT_SECRET.code,
      details:
        `AUTH_JWT_SECRET is ${secret.length} characters carrying at most ~${bits} bits of entropy, ` +
        `below the ${MINIMUM_JWT_SECRET_BITS} bits (32 bytes) required — length alone is not entropy, ` +
        'so a long repetitive string scores near zero. Generate one with `openssl rand -hex 48`.',
    },
  ];
}

function collectUnsafeCorsOrigins(env: NodeJS.ProcessEnv): ErrorArgsInterface[] {
  const raw: string = env.CORS_ORIGINS ?? '';
  const origins: string[] = raw
    .split(',')
    .map((origin: string): string => origin.trim())
    .filter((origin: string): boolean => origin.length > 0);

  if (origins.length === 0) {
    return [
      {
        code: PRODUCTION_UNSAFE_CORS_ORIGIN.code,
        details:
          'CORS_ORIGINS is unset, so the app would fall back to the localhost development origins — ' +
          'set it to a comma-separated list of your deployed frontend origins.',
      },
    ];
  }

  return origins
    .filter((origin: string): boolean => isUnsafeOrigin(origin))
    .map(
      (origin: string): ErrorArgsInterface => ({
        code: PRODUCTION_UNSAFE_CORS_ORIGIN.code,
        details:
          `CORS_ORIGINS entry "${origin}" is a wildcard or a loopback address — ` +
          'list the exact https origins of your deployed frontends instead.',
      }),
    );
}

function isUnsafeOrigin(origin: string): boolean {
  if (origin.includes('*')) return true;

  try {
    return LOOPBACK_HOSTNAMES.includes(new URL(origin).hostname.toLowerCase());
  } catch {
    return origin.toLowerCase().includes('localhost');
  }
}

function collectUnauthenticatedSwagger(env: NodeJS.ProcessEnv): ErrorArgsInterface[] {
  const isForced: boolean = env.SWAGGER_ENABLED === 'true';
  const hasCredentials: boolean =
    (env.SWAGGER_USER ?? '').length > 0 && (env.SWAGGER_PASSWORD ?? '').length > 0;

  if (!isForced || hasCredentials) return [];

  return [
    {
      code: PRODUCTION_UNAUTHENTICATED_SWAGGER.code,
      details:
        'SWAGGER_ENABLED=true would publish /docs — every route, DTO and error code — to anyone. ' +
        'Set SWAGGER_USER and SWAGGER_PASSWORD to put it behind basic auth, or unset SWAGGER_ENABLED.',
    },
  ];
}
