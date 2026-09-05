import { validateConfigSchema } from '@helpers/validate-config-schema.helper.js';
import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const configSchema = z.object({
  isEnabled: z.boolean(),
  heartbeatIntervalMs: z.number().int().positive(),
  maxConnectionsPerUser: z.number().int().positive(),
  handshakesPerMinutePerIp: z.number().int().positive(),
  heartbeatConcurrency: z.number().int().positive(),
  maxPayloadBytes: z.number().int().positive(),
});

export type WebsocketConfig = z.infer<typeof configSchema>;

// Opt-out, not opt-in — same posture as scheduler.config.ts: the gateway
// defaults on everywhere except where explicitly disabled.
// heartbeatIntervalMs is a tuning knob, not a provider credential, so a flat
// boolean + number is enough here — no discriminated union needed.
//
// The four limits below exist because a socket server accepts work before it
// has decided whether it wants it. Defaults are generous for a person and
// hostile to a script:
//
//   maxConnectionsPerUser     one account cannot pin unbounded memory, and the
//                             heartbeat cannot be turned into thousands of JWT
//                             verifies and Redis reads by a single valid token
//   handshakesPerMinutePerIp  the handshake itself is rate limited. ThrottlerGuard
//                             only ever sees @SubscribeMessage handlers, of which
//                             this gateway has none, so without this the connect
//                             path had no limit at all
//   heartbeatConcurrency      the sweep re-verifies in bounded batches instead of
//                             firing every socket's verify at once
//   maxPayloadBytes           clients never send anything on this socket, so the
//                             default 1MB frame buffer is pure attack surface
export const websocketConfig = registerAs('websocket', (): WebsocketConfig => {
  return validateConfigSchema(configSchema, {
    isEnabled: process.env.WEBSOCKET_ENABLED !== 'false',
    heartbeatIntervalMs: Number(process.env.WEBSOCKET_HEARTBEAT_INTERVAL_MS ?? 60_000),
    maxConnectionsPerUser: Number(process.env.WEBSOCKET_MAX_CONNECTIONS_PER_USER ?? 10),
    handshakesPerMinutePerIp: Number(process.env.WEBSOCKET_HANDSHAKES_PER_MINUTE_PER_IP ?? 30),
    heartbeatConcurrency: Number(process.env.WEBSOCKET_HEARTBEAT_CONCURRENCY ?? 25),
    maxPayloadBytes: Number(process.env.WEBSOCKET_MAX_PAYLOAD_BYTES ?? 8_192),
  });
});
