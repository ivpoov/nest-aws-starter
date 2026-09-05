import type { RetentionConfig } from '@configs/retention.config.js';

// The retention config every spec that constructs a service now needs. Shared
// so a new window added to the config is one edit here rather than one per
// spec, and so no spec silently pins a stale shape.
export const FAKE_RETENTION_CONFIG: RetentionConfig = {
  isEnabled: true,
  activityDays: 365,
  notificationDays: 180,
  sessionDays: 90,
  webhookEventDays: 90,
  batchSize: 1_000,
};
