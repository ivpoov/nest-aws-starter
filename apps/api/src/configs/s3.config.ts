import { validateScheme } from '@helpers/validate-scheme.helper.js';
import { Logger } from '@nestjs/common';
import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const scheme = z.discriminatedUnion('isEnabled', [
  z.object({ isEnabled: z.literal(false) }),
  z.object({
    isEnabled: z.literal(true),
    region: z.string().min(1),
    bucketName: z.string().min(1),
    accessKeyId: z.string().min(1),
    secretAccessKey: z.string().min(1),
    endpoint: z.url().optional(),
  }),
]);

export type S3Config = z.infer<typeof scheme>;

export const s3Config = registerAs('s3', (): S3Config => {
  const isEnabled: boolean = process.env.S3_ENABLED === 'true';

  const config: S3Config = isEnabled
    ? {
        isEnabled: true,
        region: process.env.AWS_REGION ?? '',
        bucketName: process.env.S3_BUCKET_NAME ?? '',
        accessKeyId: process.env.S3_ACCESS_KEY ?? '',
        secretAccessKey: process.env.S3_SECRET_KEY ?? '',
        ...(process.env.S3_ENDPOINT && { endpoint: process.env.S3_ENDPOINT }),
      }
    : { isEnabled: false };

  validateScheme(scheme, config, new Logger('S3Config'));

  return config;
});
