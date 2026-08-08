import { collectProductionViolations } from '@helpers/collect-production-violations.helper.js';
import type { ErrorArgsInterface } from '@interfaces/error-args.interface.js';
import { describe, expect, it } from 'vitest';

const STRONG_SECRET =
  'd75e83775009476bd493d89108682e707d62a9e0dca64ac74fd297cd5b57587f04caa4a28936b6417e345ebeb99e585e';

function hardenedEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    AUTH_JWT_SECRET: STRONG_SECRET,
    CORS_ORIGINS: 'https://app.example.com,https://admin.example.com',
    DATABASE_URL: 'postgresql://api:PLACEHOLDER@db.internal:5432/starter?connection_limit=10',
    REDIS_URL: 'redis://cache.internal:6379',
    WEB_APP_BASE_URL: 'https://app.example.com',
    ...overrides,
  };
}

function codesOf(violations: ErrorArgsInterface[]): string[] {
  return violations.map((violation: ErrorArgsInterface): string => violation.code);
}

describe('collectProductionViolations', () => {
  it('reports nothing for a hardened environment', () => {
    expect(collectProductionViolations(hardenedEnv())).toEqual([]);
  });

  it('flags a secret still set to its shipped development default', () => {
    const violations: ErrorArgsInterface[] = collectProductionViolations(
      hardenedEnv({ AUTH_JWT_SECRET: 'local-development-secret-change-me-32chars' }),
    );

    expect(codesOf(violations)).toContain('PRODUCTION_DEVELOPMENT_DEFAULT');
    expect(violations[0]?.details).toContain('AUTH_JWT_SECRET');
    expect(violations[0]?.details).toContain('openssl rand -hex 48');
  });

  it('flags every development default that is still in place, not just the first', () => {
    const violations: ErrorArgsInterface[] = collectProductionViolations(
      hardenedEnv({
        AWS_ACCESS_KEY_ID: 'test',
        AWS_SECRET_ACCESS_KEY: 'test',
        S3_ACCESS_KEY: 'minioadmin',
        S3_SECRET_KEY: 'minioadmin',
      }),
    );

    expect(violations).toHaveLength(4);
    expect(codesOf(violations)).toEqual(Array(4).fill('PRODUCTION_DEVELOPMENT_DEFAULT'));
  });

  it('flags a long but low-entropy jwt secret that a length check would pass', () => {
    const violations: ErrorArgsInterface[] = collectProductionViolations(
      hardenedEnv({ AUTH_JWT_SECRET: 'a'.repeat(64) }),
    );

    expect(codesOf(violations)).toEqual(['PRODUCTION_WEAK_JWT_SECRET']);
    expect(violations[0]?.details).toContain('AUTH_JWT_SECRET');
    expect(violations[0]?.details).toContain('openssl rand -hex 48');
  });

  it('accepts a jwt secret from the recommended generator', () => {
    const violations: ErrorArgsInterface[] = collectProductionViolations(
      hardenedEnv({
        AUTH_JWT_SECRET: '8728581037600e0b512a75d80444bd6e5889fd42cff99683aa6f4e4ddcf47608',
      }),
    );

    expect(violations).toEqual([]);
  });

  it('flags a wildcard cors origin', () => {
    const violations: ErrorArgsInterface[] = collectProductionViolations(
      hardenedEnv({ CORS_ORIGINS: '*' }),
    );

    expect(codesOf(violations)).toEqual(['PRODUCTION_UNSAFE_CORS_ORIGIN']);
    expect(violations[0]?.details).toContain('CORS_ORIGINS');
  });

  it('flags loopback cors origins one message at a time', () => {
    const violations: ErrorArgsInterface[] = collectProductionViolations(
      hardenedEnv({
        CORS_ORIGINS: 'https://app.example.com,http://localhost:5173,http://127.0.0.1',
      }),
    );

    expect(violations).toHaveLength(2);
    expect(violations[0]?.details).toContain('http://localhost:5173');
    expect(violations[1]?.details).toContain('http://127.0.0.1');
  });

  it('flags an unset CORS_ORIGINS, which falls back to the localhost defaults', () => {
    const violations: ErrorArgsInterface[] = collectProductionViolations(
      hardenedEnv({ CORS_ORIGINS: undefined }),
    );

    expect(codesOf(violations)).toEqual(['PRODUCTION_UNSAFE_CORS_ORIGIN']);
  });

  it('flags swagger force-enabled without basic-auth credentials', () => {
    const violations: ErrorArgsInterface[] = collectProductionViolations(
      hardenedEnv({ SWAGGER_ENABLED: 'true' }),
    );

    expect(codesOf(violations)).toEqual(['PRODUCTION_UNAUTHENTICATED_SWAGGER']);
    expect(violations[0]?.details).toContain('SWAGGER_USER');
  });

  it('accepts swagger force-enabled behind basic-auth credentials', () => {
    const violations: ErrorArgsInterface[] = collectProductionViolations(
      hardenedEnv({
        SWAGGER_ENABLED: 'true',
        SWAGGER_USER: 'docs',
        SWAGGER_PASSWORD: 'PLACEHOLDER',
      }),
    );

    expect(violations).toEqual([]);
  });

  it('reports every category in one pass so a bad deploy costs one round trip', () => {
    const violations: ErrorArgsInterface[] = collectProductionViolations({
      AUTH_JWT_SECRET: 'local-development-secret-change-me-32chars',
      CORS_ORIGINS: 'http://localhost:5173',
      SWAGGER_ENABLED: 'true',
    });

    expect(new Set(codesOf(violations))).toEqual(
      new Set([
        'PRODUCTION_DEVELOPMENT_DEFAULT',
        'PRODUCTION_WEAK_JWT_SECRET',
        'PRODUCTION_UNSAFE_CORS_ORIGIN',
        'PRODUCTION_UNAUTHENTICATED_SWAGGER',
      ]),
    );
  });
});
