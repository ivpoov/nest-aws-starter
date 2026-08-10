import type { Cluster, Redis } from 'ioredis';

// Every keyless walk (SCAN, and anything else with no key to route by) has to
// fan out over the masters, and `nodes('master')` reads the slot map — which is
// EMPTY until the cluster client has run its first command, because the client
// is built with `lazyConnect`. A fan-out issued before then walks zero nodes
// and returns success: an admin lockout list that is empty rather than wrong,
// a `deleteByPrefix` that deletes nothing. Silent, and exactly the class of bug
// the fan-out was added to fix.
//
// `ping()` is the cheapest command that forces the slot map to exist, and it is
// skipped once the client is ready, so the cost is one round trip on a cold
// process and nothing at all afterwards.
export async function resolveClusterMasters(cluster: Cluster): Promise<Redis[]> {
  if (cluster.status !== 'ready') await cluster.ping();

  return cluster.nodes('master');
}
