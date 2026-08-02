import type { SnsConfig } from '@configs/sns.config.js';

export type EnabledSnsConfigType = Extract<SnsConfig, { isEnabled: true }>;
