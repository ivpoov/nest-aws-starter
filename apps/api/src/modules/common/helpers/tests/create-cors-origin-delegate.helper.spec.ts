import type { AppConfig } from '@configs/app.config.js';
import { createCorsOriginDelegate } from '@helpers/create-cors-origin-delegate.helper.js';
import type { CorsOriginDelegateType } from '@modules/common/types/cors-origin-delegate.type.js';
import { describe, expect, it } from 'vitest';

const CONFIGURED_ORIGINS: readonly string[] = [
  'https://app.example.com',
  'https://admin.example.com',
];

function buildConfig(env: AppConfig['env'], corsOrigins: readonly string[]): AppConfig {
  return {
    port: 3000,
    env,
    apiPrefix: 'api',
    trustProxy: false,
    corsOrigins: [...corsOrigins],
  };
}

// Both CORS implementations call the delegate synchronously and read the
// answer from the callback, so the spec does the same rather than asserting
// on a returned value the delegate does not have.
function isAllowed(delegate: CorsOriginDelegateType, requestOrigin: string | undefined): boolean {
  const answers: boolean[] = [];

  delegate(requestOrigin, (error: Error | null, allowed: boolean): void => {
    expect(error).toBeNull();
    answers.push(allowed);
  });

  expect(answers).toHaveLength(1);

  return answers[0] === true;
}

describe('createCorsOriginDelegate', () => {
  describe('outside production', () => {
    const delegate: CorsOriginDelegateType = createCorsOriginDelegate(
      buildConfig('development', CONFIGURED_ORIGINS),
    );

    it.each([...CONFIGURED_ORIGINS])('allows the configured origin %s', (origin: string) => {
      expect(isAllowed(delegate, origin)).toBe(true);
    });

    // The whole reason this rule exists: Vite falls back to the next free
    // port without saying so, and 5175 (or 61234) must not be a dead end.
    it.each([
      'http://localhost:5173',
      'http://localhost:5175',
      'http://localhost:61234',
      'http://localhost',
      'http://127.0.0.1:61234',
      'http://[::1]:61234',
      'http://LOCALHOST:61234',
    ])('allows the loopback origin %s on any port', (origin: string) => {
      expect(isAllowed(delegate, origin)).toBe(true);
    });

    // Every one of these is a host an attacker can own while carrying
    // "localhost" or "127.0.0.1" somewhere a prefix, suffix or substring
    // check would find it. The delegate parses the origin and compares the
    // hostname, so none of them match.
    it.each([
      'http://localhost.evil.tld',
      'http://localhost.evil.tld:61234',
      'http://localhost:5173.evil.tld',
      'http://localhost:5173@evil.tld',
      'http://evil.tld/?x=localhost',
      'http://evil.tld#localhost',
      'http://notlocalhost',
      'http://127.0.0.1.evil.tld',
      'http://evil.tld',
      'https://evil.example',
      'null',
      '',
    ])('refuses the lookalike origin %s', (origin: string) => {
      expect(isAllowed(delegate, origin)).toBe(false);
    });

    // A TLS-terminating dev server is a deliberate setup, so its origin
    // belongs in CORS_ORIGINS. Only the port is absorbed here, never the
    // scheme.
    it('refuses an https loopback origin', () => {
      expect(isAllowed(delegate, 'https://localhost:61234')).toBe(false);
    });

    it('refuses a request that carries no Origin header', () => {
      expect(isAllowed(delegate, undefined)).toBe(false);
    });

    it('applies the same latitude under NODE_ENV=test', () => {
      const testDelegate: CorsOriginDelegateType = createCorsOriginDelegate(
        buildConfig('test', CONFIGURED_ORIGINS),
      );

      expect(isAllowed(testDelegate, 'http://localhost:61234')).toBe(true);
    });
  });

  // The production boot guard already refuses to start when CORS_ORIGINS
  // holds a wildcard or a loopback address. This is the other half of that
  // promise: even asked directly, a production delegate grants nothing beyond
  // the configured list — there is no env var, header or pattern that turns
  // the loopback rule back on.
  describe('in production', () => {
    const delegate: CorsOriginDelegateType = createCorsOriginDelegate(
      buildConfig('production', CONFIGURED_ORIGINS),
    );

    it.each([...CONFIGURED_ORIGINS])('allows the configured origin %s', (origin: string) => {
      expect(isAllowed(delegate, origin)).toBe(true);
    });

    it.each([
      'http://localhost:5173',
      'http://localhost:61234',
      'http://127.0.0.1:61234',
      'http://[::1]:61234',
      'http://localhost',
    ])('refuses the loopback origin %s', (origin: string) => {
      expect(isAllowed(delegate, origin)).toBe(false);
    });

    it('refuses an origin that is a subdomain of a configured one', () => {
      expect(isAllowed(delegate, 'https://evil.app.example.com')).toBe(false);
    });

    it('refuses an origin that merely starts with a configured one', () => {
      expect(isAllowed(delegate, 'https://app.example.com.evil.tld')).toBe(false);
    });

    // Reached only if someone bypasses the boot guard (a `production` env
    // value set from somewhere the guard never inspected). Even then a
    // configured loopback entry buys exactly itself and no other port.
    it('grants a configured loopback entry itself but still no other port', () => {
      const looseDelegate: CorsOriginDelegateType = createCorsOriginDelegate(
        buildConfig('production', ['http://localhost:5173']),
      );

      expect(isAllowed(looseDelegate, 'http://localhost:5173')).toBe(true);
      expect(isAllowed(looseDelegate, 'http://localhost:5174')).toBe(false);
    });
  });
});
