import { lambdaConfig } from '@configs/lambda.config.js';
import { InternalError } from '@modules/common/errors/internal.error.js';
import { DisabledLambdaProviderService } from '@providers/lambda/services/disabled-lambda-provider.service.js';
import { LambdaProviderService } from '@providers/lambda/services/lambda-provider.service.js';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('lambdaConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('skips all validation when disabled', () => {
    vi.stubEnv('LAMBDA_ENABLED', 'false');
    vi.stubEnv('AWS_REGION', '');

    expect(lambdaConfig()).toEqual({ isEnabled: false });
  });

  it('fails boot when enabled with missing variables', () => {
    vi.stubEnv('LAMBDA_ENABLED', 'true');
    vi.stubEnv('AWS_REGION', '');

    expect(() => lambdaConfig()).toThrow(/Invalid configuration/);
  });

  it('accepts a complete enabled configuration', () => {
    vi.stubEnv('LAMBDA_ENABLED', 'true');
    vi.stubEnv('AWS_REGION', 'us-east-1');

    expect(lambdaConfig()).toMatchObject({ isEnabled: true, region: 'us-east-1' });
  });
});

describe('DisabledLambdaProviderService', () => {
  it('throws the coded disabled error', () => {
    const provider: DisabledLambdaProviderService = new DisabledLambdaProviderService();

    try {
      void provider.invoke('fn', {});
      expect.unreachable('should have thrown');
    } catch (caught) {
      expect(caught).toBeInstanceOf(InternalError);
      expect((caught as InternalError).args.code).toBe('LAMBDA_PROVIDER_DISABLED');
    }
  });
});

describe('LambdaProviderService', () => {
  function createService(): LambdaProviderService {
    return new LambdaProviderService({ isEnabled: true, region: 'us-east-1' });
  }

  it('invokes and parses the response payload', async () => {
    const service: LambdaProviderService = createService();
    const send = vi.fn().mockResolvedValue({
      Payload: Buffer.from(JSON.stringify({ echoed: { value: 7 } })),
    });

    // biome-ignore lint/suspicious/noExplicitAny: reaching into the private client for mocking
    (service as any).client.send = send;

    const result: { echoed: { value: number } } = await service.invoke('starter-example', {
      value: 7,
    });

    expect(result).toEqual({ echoed: { value: 7 } });
  });

  it('throws the coded invocation error on function errors', async () => {
    const service: LambdaProviderService = createService();
    const send = vi.fn().mockResolvedValue({
      FunctionError: 'Unhandled',
      Payload: Buffer.from('{}'),
    });

    // biome-ignore lint/suspicious/noExplicitAny: reaching into the private client for mocking
    (service as any).client.send = send;

    await expect(service.invoke('starter-example', {})).rejects.toSatisfy(
      (caught: unknown): boolean =>
        caught instanceof InternalError && caught.args.code === 'LAMBDA_INVOCATION_FAILED',
    );
  });
});
