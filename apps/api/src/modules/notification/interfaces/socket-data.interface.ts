import type { CurrentUserInterface } from '@interfaces/current-user.interface.js';

// Attached to `socket.data` once at handshake (see NotificationGateway).
// `token` is kept alongside `user` because the 60s revalidation sweep must
// re-run TokenService.verifyAccessToken with the exact original access
// token — that call checks both signature/expiry and Redis-allowlist
// membership, and only the raw token (not the decoded principal) carries
// enough information to redo it.
export interface SocketDataInterface {
  readonly user: CurrentUserInterface;
  readonly token: string;
}
