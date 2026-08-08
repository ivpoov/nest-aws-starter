// Preferences are per type x per channel. IN_APP is always on (immutable,
// PR 5's binding rule) — preferences gate EMAIL only in this release. The
// shape supports adding channels later (e.g. PUSH) without a migration.
export enum NotificationChannelEnum {
  IN_APP = 'IN_APP',
  EMAIL = 'EMAIL',
}
