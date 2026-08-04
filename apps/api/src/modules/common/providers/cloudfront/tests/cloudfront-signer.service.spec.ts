import { generateKeyPairSync } from 'node:crypto';
import { cloudfrontConfig } from '@configs/cloudfront.config.js';
import { InternalError } from '@modules/common/errors/internal.error.js';
import { CloudFrontSignerService } from '@providers/cloudfront/services/cloudfront-signer.service.js';
import { DisabledCloudFrontSignerService } from '@providers/cloudfront/services/disabled-cloudfront-signer.service.js';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('cloudfrontConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('skips all validation when disabled', () => {
    vi.stubEnv('CLOUDFRONT_ENABLED', 'false');
    vi.stubEnv('CLOUDFRONT_DOMAIN', '');
    vi.stubEnv('CLOUDFRONT_KEY_PAIR_ID', '');
    vi.stubEnv('CLOUDFRONT_PRIVATE_KEY', '');

    expect(cloudfrontConfig()).toEqual({ isEnabled: false });
  });

  it('fails boot when enabled with missing variables', () => {
    vi.stubEnv('CLOUDFRONT_ENABLED', 'true');
    vi.stubEnv('CLOUDFRONT_DOMAIN', '');
    vi.stubEnv('CLOUDFRONT_KEY_PAIR_ID', '');
    vi.stubEnv('CLOUDFRONT_PRIVATE_KEY', '');

    expect(() => cloudfrontConfig()).toThrow(/Invalid configuration/);
  });

  it('normalizes literal newline sequences in the private key', () => {
    vi.stubEnv('CLOUDFRONT_ENABLED', 'true');
    vi.stubEnv('CLOUDFRONT_DOMAIN', 'cdn.example.com');
    vi.stubEnv('CLOUDFRONT_KEY_PAIR_ID', 'K2JCJMDEHXQW5F');
    vi.stubEnv(
      'CLOUDFRONT_PRIVATE_KEY',
      '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----',
    );

    const config = cloudfrontConfig();

    expect(config).toMatchObject({
      isEnabled: true,
      domain: 'cdn.example.com',
      privateKey: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----',
      urlTtlSec: 300,
    });
  });
});

describe('DisabledCloudFrontSignerService', () => {
  it('throws the coded disabled error', async () => {
    const signer: DisabledCloudFrontSignerService = new DisabledCloudFrontSignerService();

    try {
      await signer.getSignedUrl('files/1');
      expect.unreachable('should have thrown');
    } catch (caught) {
      expect(caught).toBeInstanceOf(InternalError);
      expect((caught as InternalError).args.code).toBe('CLOUDFRONT_SIGNER_DISABLED');
    }
  });
});

describe('CloudFrontSignerService', () => {
  it('produces a signed url carrying the key-pair id and signature', async () => {
    const { privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    const service: CloudFrontSignerService = new CloudFrontSignerService({
      isEnabled: true,
      domain: 'cdn.example.com',
      keyPairId: 'K2JCJMDEHXQW5F',
      privateKey,
      urlTtlSec: 300,
    });

    const url: string = await service.getSignedUrl('files/u1/abc.png');

    expect(url).toContain('https://cdn.example.com/files/u1/abc.png');
    expect(url).toContain('Key-Pair-Id=K2JCJMDEHXQW5F');
    expect(url).toContain('Signature=');
    expect(url).toContain('Expires=');
  });
});
