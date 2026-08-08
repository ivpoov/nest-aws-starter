// What a builder produces from a raw event payload — denormalized text plus
// deep-link data, stored as-is on the Notification row (backend.md §11a's
// "subtraction-safe" rule: no join back to the emitting feature's tables).
export interface NotificationContentInterface {
  readonly title: string;
  readonly body: string;
  readonly meta: Record<string, unknown>;
}
