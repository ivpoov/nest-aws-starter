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

    expect(s3Config()).toMatchObject({
      isEnabled: true,
      bucketName: 'starter',
      credentials: { accessKeyId: 'minioadmin', secretAccessKey: 'minioadmin' },
    });
  });

  it('omits credentials entirely when no static keys are configured', () => {
    vi.stubEnv('S3_ENABLED', 'true');
    vi.stubEnv('AWS_REGION', 'us-east-1');
    vi.stubEnv('S3_BUCKET_NAME', 'starter');
    vi.stubEnv('S3_ACCESS_KEY', '');
    vi.stubEnv('S3_SECRET_KEY', '');
    vi.stubEnv('S3_ENDPOINT', '');

    expect(s3Config()).toEqual({ isEnabled: true, region: 'us-east-1', bucketName: 'starter' });
  });

  it('fails boot when only one half of the static key pair is set', () => {
    vi.stubEnv('S3_ENABLED', 'true');
    vi.stubEnv('AWS_REGION', 'us-east-1');
    vi.stubEnv('S3_BUCKET_NAME', 'starter');
    vi.stubEnv('S3_ACCESS_KEY', 'minioadmin');
    vi.stubEnv('S3_SECRET_KEY', '');

    expect(() => s3Config()).toThrow(/Invalid configuration/);
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
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('signs with the configured static keys when they are present', async () => {
    vi.stubEnv('AWS_ACCESS_KEY_ID', 'chain-key');
    vi.stubEnv('AWS_SECRET_ACCESS_KEY', 'chain-secret');

    const service: S3ProviderService = new S3ProviderService({
      isEnabled: true,
      region: 'us-east-1',
      bucketName: 'starter',
      credentials: { accessKeyId: 'static-key', secretAccessKey: 'static-secret' },
    });
    // biome-ignore lint/suspicious/noExplicitAny: reaching into the private client to resolve its credentials
    const identity = await (service as any).client.config.credentials();
    const accessKeyId: string = identity.accessKeyId;

    expect(accessKeyId).toBe('static-key');
  });

  it('falls back to the default credential chain when no static keys are configured', async () => {
    vi.stubEnv('AWS_ACCESS_KEY_ID', 'chain-key');
    vi.stubEnv('AWS_SECRET_ACCESS_KEY', 'chain-secret');

    const service: S3ProviderService = new S3ProviderService({
      isEnabled: true,
      region: 'us-east-1',
      bucketName: 'starter',
    });
    // biome-ignore lint/suspicious/noExplicitAny: reaching into the private client to resolve its credentials
    const identity = await (service as any).client.config.credentials();
    const accessKeyId: string = identity.accessKeyId;

    expect(accessKeyId).toBe('chain-key');
  });

  it('uploads through the client and returns the key', async () => {
    const service: S3ProviderService = new S3ProviderService({
      isEnabled: true,
      region: 'us-east-1',
      bucketName: 'starter',
      credentials: { accessKeyId: 'a', secretAccessKey: 'b' },
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

  it('returns object metadata on a successful head request', async () => {
    const service: S3ProviderService = new S3ProviderService({
      isEnabled: true,
      region: 'us-east-1',
      bucketName: 'starter',
      credentials: { accessKeyId: 'a', secretAccessKey: 'b' },
    });
    const send = vi.fn().mockResolvedValue({ ContentLength: 1024, ContentType: 'image/png' });

    // biome-ignore lint/suspicious/noExplicitAny: reaching into the private client for mocking
    (service as any).client.send = send;

    const result = await service.headObject('avatars/1.png');

    expect(result).toEqual({ contentLength: 1024, contentType: 'image/png' });
  });

  it('returns null when the object does not exist', async () => {
    const service: S3ProviderService = new S3ProviderService({
      isEnabled: true,
      region: 'us-east-1',
      bucketName: 'starter',
      credentials: { accessKeyId: 'a', secretAccessKey: 'b' },
    });
    const notFound = Object.assign(new Error('not found'), { name: 'NotFound' });
    const send = vi.fn().mockRejectedValue(notFound);

    // biome-ignore lint/suspicious/noExplicitAny: reaching into the private client for mocking
    (service as any).client.send = send;

    const result = await service.headObject('missing.png');

    expect(result).toBeNull();
  });
});
