import type { S3Config } from '@configs/s3.config.js';

export type EnabledS3ConfigType = Extract<S3Config, { isEnabled: true }>;
