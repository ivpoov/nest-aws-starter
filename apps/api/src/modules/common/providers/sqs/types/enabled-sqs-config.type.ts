import type { SqsConfig } from '@configs/sqs.config.js';

export type EnabledSqsConfigType = Extract<SqsConfig, { isEnabled: true }>;
