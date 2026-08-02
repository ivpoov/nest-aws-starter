import type { LambdaConfig } from '@configs/lambda.config.js';

export type EnabledLambdaConfigType = Extract<LambdaConfig, { isEnabled: true }>;
