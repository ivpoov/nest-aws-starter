import { resolveClusterMasters } from '@providers/redis/helpers/resolve-cluster-masters.helper.js';
import type { Cluster, Redis } from 'ioredis';
import { describe, expect, it, vi } from 'vitest';

function createCluster(status: string): {
  cluster: Cluster;
  ping: ReturnType<typeof vi.fn>;
  masters: Redis[];
} {
  const masters: Redis[] = [{} as Redis, {} as Redis];
  let currentStatus: string = status;
  const ping = vi.fn().mockImplementation((): Promise<string> => {
    currentStatus = 'ready';

    return Promise.resolve('PONG');
  });
  const cluster = {
    ping,
    get status(): string {
      return currentStatus;
    },
    nodes: vi.fn().mockImplementation((): Redis[] => (currentStatus === 'ready' ? masters : [])),
  } as unknown as Cluster;

  return { cluster, ping, masters };
}

describe('resolveClusterMasters', () => {
  // The client is built with `lazyConnect`, so before its first command the
  // slot map is empty and `nodes('master')` returns []. A fan-out over that
  // walks nothing and reports success — an empty admin lockout list, a
  // `deleteByPrefix` that deletes nothing.
  it('populates the slot map before reading it when the client has not connected yet', async () => {
    const { cluster, ping, masters } = createCluster('wait');

    const resolved: Redis[] = await resolveClusterMasters(cluster);

    expect(ping).toHaveBeenCalledTimes(1);
    expect(resolved).toEqual(masters);
  });

  it('costs nothing once the client is ready', async () => {
    const { cluster, ping, masters } = createCluster('ready');

    const resolved: Redis[] = await resolveClusterMasters(cluster);

    expect(ping).not.toHaveBeenCalled();
    expect(resolved).toEqual(masters);
  });
});
