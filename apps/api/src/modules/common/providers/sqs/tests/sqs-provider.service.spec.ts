import { sqsConfig } from '@configs/sqs.config.js';
import { InternalError } from '@modules/common/errors/internal.error.js';
import { DisabledSqsProviderService } from '@providers/sqs/services/disabled-sqs-provider.service.js';
import { SqsProviderService } from '@providers/sqs/services/sqs-provider.service.js';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('sqsConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('skips all validation when disabled', () => {
    vi.stubEnv('SQS_ENABLED', 'false');
    vi.stubEnv('AWS_REGION', '');

    expect(sqsConfig()).toEqual({ isEnabled: false });
  });

  it('fails boot when enabled with missing variables', () => {
    vi.stubEnv('SQS_ENABLED', 'true');
    vi.stubEnv('AWS_REGION', '');

    expect(() => sqsConfig()).toThrow(/Invalid configuration/);
  });

  it('accepts a complete enabled configuration', () => {
    vi.stubEnv('SQS_ENABLED', 'true');
    vi.stubEnv('AWS_REGION', 'us-east-1');
    vi.stubEnv('AWS_ENDPOINT_URL', 'http://localhost:4567');

    expect(sqsConfig()).toMatchObject({ isEnabled: true, region: 'us-east-1' });
  });
});

describe('DisabledSqsProviderService', () => {
  it('throws the coded disabled error', () => {
    const provider: DisabledSqsProviderService = new DisabledSqsProviderService();

    try {
      void provider.sendMessage('url', {});
      expect.unreachable('should have thrown');
    } catch (caught) {
      expect(caught).toBeInstanceOf(InternalError);
      expect((caught as InternalError).args.code).toBe('SQS_PROVIDER_DISABLED');
    }
  });
});

describe('SqsProviderService', () => {
  it('sends a message and returns the message id', async () => {
    const service: SqsProviderService = new SqsProviderService({
      isEnabled: true,
      region: 'us-east-1',
    });
    const send = vi.fn().mockResolvedValue({ MessageId: 'msg-1' });

    // biome-ignore lint/suspicious/noExplicitAny: reaching into the private client for mocking
    (service as any).client.send = send;

    const messageId: string = await service.sendMessage('http://queue', { hello: true });

    expect(messageId).toBe('msg-1');
    expect(send).toHaveBeenCalledOnce();
  });
});
