import { validateConfigSchema } from '@helpers/validate-config-schema.helper.js';
import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const scheme = z.object({
  isEnabled: z.boolean(),
  heartbeatIntervalMs: z.number().int().positive(),
});

export type WebsocketConfig = Required<z.infer<typeof scheme>>;

// Opt-out, not opt-in — same posture as scheduler.config.ts: the gateway
// defaults on everywhere except where explicitly disabled.
// heartbeatIntervalMs is a tuning knob, not a provider credential, so a flat
// boolean + number is enough here — no discriminated union needed.
export const websocketConfig = registerAs('websocket', (): WebsocketConfig => {
  return validateConfigSchema(scheme, {
    isEnabled: process.env.WEBSOCKET_ENABLED !== 'false',
    heartbeatIntervalMs: Number(process.env.WEBSOCKET_HEARTBEAT_INTERVAL_MS ?? 60_000),
  });
});
