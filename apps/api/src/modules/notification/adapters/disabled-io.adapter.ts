import { IoAdapter } from '@nestjs/platform-socket.io';
import { Server, type ServerOptions } from 'socket.io';

// Installed instead of RedisIoAdapter when WEBSOCKET_ENABLED=false —
// backend.md §12: an optional provider is on or off, never half-configured.
// The gateway still compiles and resolves, but its Server is created
// detached, never attached to the HTTP server: no /socket.io endpoint
// exists, no handshake is ever accepted (clients get a hard connection
// error, not an accept-then-drop loop), and no Redis pub/sub connection is
// opened. Without this, Nest would silently fall back to the default
// IoAdapter and bind a live in-memory Socket.IO server despite the flag.
export class DisabledIoAdapter extends IoAdapter {
  public override createIOServer(_port: number, options?: ServerOptions): Server {
    return new Server(options);
  }

  // A detached Server has no engine (socket.io builds it in attach()), so the
  // inherited close() — `new Promise(resolve => server.close(resolve))` —
  // would throw inside socket.io before ever calling back, leaving
  // app.close() hanging on an unresolved promise and SIGTERM never draining.
  // Nothing was opened here, so closing is genuinely a no-op.
  public override async close(_server: Server): Promise<void> {}
}
