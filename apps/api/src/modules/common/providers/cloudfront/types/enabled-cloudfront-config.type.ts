import type { CloudFrontConfig } from '@configs/cloudfront.config.js';

export type EnabledCloudFrontConfigType = Extract<CloudFrontConfig, { isEnabled: true }>;
