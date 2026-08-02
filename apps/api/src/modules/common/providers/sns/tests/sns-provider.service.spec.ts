import { snsConfig } from '@configs/sns.config.js';
import { InternalError } from '@modules/common/errors/internal.error.js';
import { DisabledSnsProviderService } from '@providers/sns/services/disabled-sns-provider.service.js';
import { SnsProviderService } from '@providers/sns/services/sns-provider.service.js';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('snsConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('skips all validation when disabled', () => {
    vi.stubEnv('SNS_ENABLED', 'false');
    vi.stubEnv('AWS_REGION', '');

    expect(snsConfig()).toEqual({ isEnabled: false });
  });

  it('fails boot when enabled with missing variables', () => {
    vi.stubEnv('SNS_ENABLED', 'true');
    vi.stubEnv('AWS_REGION', '');

    expect(() => snsConfig()).toThrow(/Invalid configuration/);
  });

  it('accepts a complete enabled configuration', () => {
    vi.stubEnv('SNS_ENABLED', 'true');
    vi.stubEnv('AWS_REGION', 'us-east-1');

    expect(snsConfig()).toMatchObject({ isEnabled: true, region: 'us-east-1' });
  });
});

describe('DisabledSnsProviderService', () => {
  it('throws the coded disabled error', () => {
    const provider: DisabledSnsProviderService = new DisabledSnsProviderService();

    try {
      void provider.publish('arn', {});
      expect.unreachable('should have thrown');
    } catch (caught) {
      expect(caught).toBeInstanceOf(InternalError);
      expect((caught as InternalError).args.code).toBe('SNS_PROVIDER_DISABLED');
    }
  });
});

describe('SnsProviderService', () => {
  it('publishes and returns the message id', async () => {
    const service: SnsProviderService = new SnsProviderService({
      isEnabled: true,
      region: 'us-east-1',
    });
    const send = vi.fn().mockResolvedValue({ MessageId: 'sns-1' });

    // biome-ignore lint/suspicious/noExplicitAny: reaching into the private client for mocking
    (service as any).client.send = send;

    const messageId: string = await service.publish('arn:topic', { hello: true });

    expect(messageId).toBe('sns-1');
    expect(send).toHaveBeenCalledOnce();
  });
});
