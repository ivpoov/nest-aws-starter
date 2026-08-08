import type { AppConfig } from '@configs/app.config.js';
import { registerSecurityHeaders } from '@helpers/register-security-headers.helper.js';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { describe, expect, it } from 'vitest';

interface HstsOptionsInterface {
  readonly maxAge: number;
  readonly includeSubDomains: boolean;
  readonly preload: boolean;
}

interface HelmetOptionsInterface {
  readonly contentSecurityPolicy: {
    readonly useDefaults: boolean;
    readonly directives: Record<string, string[]>;
  };
  readonly strictTransportSecurity: HstsOptionsInterface | false;
  readonly referrerPolicy: { readonly policy: string };
  readonly xFrameOptions: { readonly action: string };
}

// The e2e suite can prove the non-production half by talking to a running
// app, but it cannot boot a production app to prove the other half — the
// production boot guard refuses every development default the test
// environment is made of. So the production branch is asserted here, on the
// options object itself.
async function optionsFor(env: AppConfig['env']): Promise<HelmetOptionsInterface> {
  const captured: HelmetOptionsInterface[] = [];
  const app: NestFastifyApplication = {
    get: (): { getOrThrow: () => Partial<AppConfig> } => ({ getOrThrow: () => ({ env }) }),
    register: (_plugin: unknown, options: HelmetOptionsInterface): Promise<void> => {
      captured.push(options);

      return Promise.resolve();
    },
  } as unknown as NestFastifyApplication;

  await registerSecurityHeaders(app);

  const options: HelmetOptionsInterface | undefined = captured[0];

  if (!options) throw new Error('helmet was never registered');

  return options;
}

describe('registerSecurityHeaders', () => {
  it('sends hsts only in production, with subdomains and preload', async () => {
    const options: HelmetOptionsInterface = await optionsFor('production');
    const hsts: HstsOptionsInterface | false = options.strictTransportSecurity;

    expect(hsts).not.toBe(false);
    expect((hsts as HstsOptionsInterface).maxAge).toBe(31_536_000);
    expect((hsts as HstsOptionsInterface).includeSubDomains).toBe(true);
    expect((hsts as HstsOptionsInterface).preload).toBe(true);
  });

  it('never sends hsts in development', async () => {
    const options: HelmetOptionsInterface = await optionsFor('development');

    expect(options.strictTransportSecurity).toBe(false);
  });

  it('never sends hsts in test', async () => {
    const options: HelmetOptionsInterface = await optionsFor('test');

    expect(options.strictTransportSecurity).toBe(false);
  });

  it('builds the csp for a json api rather than for a page', async () => {
    const options: HelmetOptionsInterface = await optionsFor('production');

    expect(options.contentSecurityPolicy.useDefaults).toBe(false);
    expect(options.contentSecurityPolicy.directives['default-src']).toEqual(["'none'"]);
    expect(options.contentSecurityPolicy.directives['frame-ancestors']).toEqual(["'none'"]);
  });

  it('denies framing and leaks no referrer, in every environment', async () => {
    const production: HelmetOptionsInterface = await optionsFor('production');
    const development: HelmetOptionsInterface = await optionsFor('development');

    expect(production.xFrameOptions.action).toBe('deny');
    expect(development.xFrameOptions.action).toBe('deny');
    expect(production.referrerPolicy.policy).toBe('no-referrer');
    expect(development.referrerPolicy.policy).toBe('no-referrer');
  });
});
