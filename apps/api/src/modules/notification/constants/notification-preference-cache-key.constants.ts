export function buildNotificationPreferenceCacheKey(userId: string): string {
  return `notification:preference:${userId}`;
}
