import { validateConfigSchema } from '@helpers/validate-config-schema.helper.js';
import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const configSchema = z.object({
  jwtSecret: z.string().min(32),
  accessTtlSec: z.number().int().positive(),
  refreshTtlSec: z.number().int().positive(),
  refreshGraceSec: z.number().int().positive(),
});

export type AuthConfig = z.infer<typeof configSchema>;

export const authConfig = registerAs('auth', (): AuthConfig => {
  return validateConfigSchema(configSchema, {
    jwtSecret: process.env.AUTH_JWT_SECRET ?? '',
    accessTtlSec: Number(process.env.AUTH_ACCESS_TTL_SEC ?? 900),
    refreshTtlSec: Number(process.env.AUTH_REFRESH_TTL_SEC ?? 2_592_000),
    // Derived, not picked: the grace window only has to cover refreshes that
    // were already in flight when a rotation committed. That is one HTTP round
    // trip, not user think-time — a refresh POST is single-digit hundreds of
    // milliseconds at p50 and ~1-3s at p99 on a slow mobile network, so 10s is
    // roughly 3-10x the worst realistic overlap. Every second above that buys
    // no concurrency and is pure exposure: inside the window a captured
    // superseded token can be traded for the live pair with the reuse tripwire
    // silent (see SessionService.replayGracePair), so the window IS the bound
    // on that risk. Raise it only if clients genuinely retry refreshes over a
    // longer span than a single request.
    refreshGraceSec: Number(process.env.AUTH_REFRESH_GRACE_SEC ?? 10),
  });
});
