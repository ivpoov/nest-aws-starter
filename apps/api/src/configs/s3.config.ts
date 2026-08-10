import { validateConfigSchema } from '@helpers/validate-config-schema.helper.js';
import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const configSchema = z.discriminatedUnion('isEnabled', [
  z.object({ isEnabled: z.literal(false) }),
  z.object({
    isEnabled: z.literal(true),
    region: z.string().min(1),
    bucketName: z.string().min(1),
    // Absent = the AWS default credential provider chain signs requests, which
    // is how a deployed task uses its IAM role instead of a long-lived key
    // pair. Present = static keys, which MinIO and other non-AWS endpoints
    // require. Setting one half of the pair fails boot rather than silently
    // falling back to the chain.
    credentials: z
      .object({
        accessKeyId: z.string().min(1),
        secretAccessKey: z.string().min(1),
      })
      .optional(),
    endpoint: z.url().optional(),
  }),
]);

export type S3Config = z.infer<typeof configSchema>;

export const s3Config = registerAs('s3', (): S3Config => {
  const isEnabled: boolean = process.env.S3_ENABLED === 'true';

  const hasStaticCredentials: boolean = Boolean(
    process.env.S3_ACCESS_KEY || process.env.S3_SECRET_KEY,
  );

  return validateConfigSchema(
    configSchema,
    isEnabled
      ? {
          isEnabled: true,
          region: process.env.AWS_REGION ?? '',
          bucketName: process.env.S3_BUCKET_NAME ?? '',
          ...(hasStaticCredentials && {
            credentials: {
              accessKeyId: process.env.S3_ACCESS_KEY ?? '',
              secretAccessKey: process.env.S3_SECRET_KEY ?? '',
            },
          }),
          ...(process.env.S3_ENDPOINT && { endpoint: process.env.S3_ENDPOINT }),
        }
      : { isEnabled: false },
  );
});
