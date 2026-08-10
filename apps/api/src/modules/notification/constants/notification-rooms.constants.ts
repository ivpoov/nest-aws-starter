// Room-naming contract PR 3's event subscriber depends on: NotificationGateway
// joins every authenticated socket to `user:<id>` and, when the principal's
// role is ADMIN, to ADMIN_ROOM as well. The event subscriber targets these same
// room names to fan a notification out to a user (or to every admin) —
// change either side and the other breaks silently, so build both room
// names only through these exports, never by hand-concatenating a string.
export const ADMIN_ROOM = 'admins';

export function buildUserRoom(userId: string): string {
  return `user:${userId}`;
}
