import { DisabledIoAdapter } from '@modules/notification/adapters/disabled-io.adapter.js';
import type { INestApplicationContext } from '@nestjs/common';
import type { Server } from 'socket.io';
import { describe, expect, it } from 'vitest';

// The off-switch half of backend.md §12's "no third state": with
// WEBSOCKET_ENABLED=false the process must hold no socket endpoint and no
// adapter connections, and must still shut down cleanly.
describe('DisabledIoAdapter', () => {
  function createAdapter(): DisabledIoAdapter {
    return new DisabledIoAdapter({} as unknown as INestApplicationContext);
  }

  it('creates a server bound to no HTTP server, so no /socket.io route exists', () => {
    const server: Server = createAdapter().createIOServer(3000);

    expect(server.httpServer).toBeUndefined();
  });

  it('resolves close() instead of hanging on a server that was never attached', async () => {
    const adapter: DisabledIoAdapter = createAdapter();
    const server: Server = adapter.createIOServer(3000);

    // The inherited close() calls into socket.io's own close(), which
    // dereferences an engine that only exists after attach() — it rejects
    // and never calls back, which used to hang app.close() for good.
    await expect(adapter.close(server)).resolves.toBeUndefined();
  });
});
