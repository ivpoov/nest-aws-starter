import type { MailConfig } from '@configs/mail.config.js';

export type EnabledMailConfigType = Extract<MailConfig, { isEnabled: true }>;
