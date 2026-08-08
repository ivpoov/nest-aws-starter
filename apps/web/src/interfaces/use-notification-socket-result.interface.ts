export interface UseNotificationSocketResultInterface {
  readonly unreadCount: number;
  readonly isConnected: boolean;
  readonly adjustUnreadCount: (delta: number) => void;
  // Re-fetches GET /notifications/unread-count and overwrites the badge with
  // the authoritative merged figure — called on the poll interval and again
  // right after a mark-read/read-all mutation so the badge does not sit on
  // a drifted optimistic delta (see notification-unread-count-poll.constants.ts).
  readonly refreshUnreadCount: () => Promise<void>;
}
