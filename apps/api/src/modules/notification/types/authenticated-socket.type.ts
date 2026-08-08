import type { SocketDataInterface } from '@modules/notification/interfaces/socket-data.interface.js';
import type { DefaultEventsMap, Socket } from 'socket.io';

// This gateway never listens for client->server messages (no RPC over the
// socket — REST stays the API), so listen/emit event maps stay the
// library defaults; only the `data` generic is specialized.
export type AuthenticatedSocketType = Socket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  SocketDataInterface
>;
