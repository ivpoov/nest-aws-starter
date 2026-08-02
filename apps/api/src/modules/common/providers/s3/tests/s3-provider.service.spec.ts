import { s3Config } from '@configs/s3.config.js';
import { InternalError } from '@modules/common/errors/internal.error.js';
import { DisabledS3ProviderService } from '@providers/s3/services/disabled-s3-provider.service.js';
import { S3ProviderService } from '@providers/s3/services/s3-provider.service.js';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('s3Config', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('skips all validation when disabled', () => {
    vi.stubEnv('S3_ENABLED', 'false');
    vi.stubEnv('S3_BUCKET_NAME', '');
    vi.stubEnv('AWS_REGION', '');

    expect(() => s3Config()).not.toThrow();
    expect(s3Config()).toEqual({ isEnabled: false });
  });

  it('fails boot when enabled with missing variables', () => {
    vi.stubEnv('S3_ENABLED', 'true');
    vi.stubEnv('AWS_REGION', '');
    vi.stubEnv('S3_BUCKET_NAME', '');
    vi.stubEnv('S3_ACCESS_KEY', '');
    vi.stubEnv('S3_SECRET_KEY', '');

    expect(() => s3Config()).toThrow(/Invalid configuration/);
  });

  it('accepts a complete enabled configuration', () => {
    vi.stubEnv('S3_ENABLED', 'true');
    vi.stubEnv('AWS_REGION', 'us-east-1');
    vi.stubEnv('S3_BUCKET_NAME', 'starter');
    vi.stubEnv('S3_ACCESS_KEY', 'minioadmin');
    vi.stubEnv('S3_SECRET_KEY', 'minioadmin');
    vi.stubEnv('S3_ENDPOINT', 'http://localhost:9010');

    expect(s3Config()).toMatchObject({ isEnabled: true, bucketName: 'starter' });
  });
});

describe('DisabledS3ProviderService', () => {
  it('throws the coded disabled error on any method', async () => {
    const provider: DisabledS3ProviderService = new DisabledS3ProviderService();

    try {
      await provider.upload({ key: 'k', body: Buffer.from('x'), contentType: 'text/plain' });
      expect.unreachable('should have thrown');
    } catch (caught) {
      expect(caught).toBeInstanceOf(InternalError);
      expect((caught as InternalError).args.code).toBe('S3_PROVIDER_DISABLED');
    }
  });
});

describe('S3ProviderService', () => {
  it('uploads through the client and returns the key', async () => {
    const service: S3ProviderService = new S3ProviderService({
      isEnabled: true,
      region: 'us-east-1',
      bucketName: 'starter',
      accessKeyId: 'a',
      secretAccessKey: 'b',
    });
    const send = vi.fn().mockResolvedValue({});

    // biome-ignore lint/suspicious/noExplicitAny: reaching into the private client for mocking
    (service as any).client.send = send;

    const key: string = await service.upload({
      key: 'avatars/1.png',
      body: Buffer.from('png'),
      contentType: 'image/png',
    });

    expect(key).toBe('avatars/1.png');
    expect(send).toHaveBeenCalledOnce();
  });
});
