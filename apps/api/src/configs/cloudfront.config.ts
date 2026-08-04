import { validateScheme } from '@helpers/validate-scheme.helper.js';
import { Logger } from '@nestjs/common';
import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const scheme = z.discriminatedUnion('isEnabled', [
  z.object({ isEnabled: z.literal(false) }),
  z.object({
    isEnabled: z.literal(true),
    domain: z.string().min(1),
    keyPairId: z.string().min(1),
    privateKey: z.string().min(1),
    urlTtlSec: z.number().int().positive(),
  }),
]);

export type CloudFrontConfig = z.infer<typeof scheme>;

// Env files can't hold real newlines — CLOUDFRONT_PRIVATE_KEY commonly arrives
// with literal "\n" sequences that need normalizing back into a real PEM.
function normalizePrivateKey(value: string): string {
  return value.replace(/\\n/g, '\n');
}

export const cloudfrontConfig = registerAs('cloudfront', (): CloudFrontConfig => {
  const isEnabled: boolean = process.env.CLOUDFRONT_ENABLED === 'true';

  const config: CloudFrontConfig = isEnabled
    ? {
        isEnabled: true,
        domain: process.env.CLOUDFRONT_DOMAIN ?? '',
        keyPairId: process.env.CLOUDFRONT_KEY_PAIR_ID ?? '',
        privateKey: normalizePrivateKey(process.env.CLOUDFRONT_PRIVATE_KEY ?? ''),
        urlTtlSec: Number(process.env.CLOUDFRONT_URL_TTL_SEC ?? 300),
      }
    : { isEnabled: false };

  validateScheme(scheme, config, new Logger('CloudFrontConfig'));

  return config;
});
