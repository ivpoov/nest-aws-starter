import type { LogLevel } from '@nestjs/common';

// Nest's levels, least to most severe. `LOG_LEVEL` names a MINIMUM: everything
// from that level up is enabled, everything below it is dropped. Order is the
// whole implementation, so it lives here once rather than as a switch that has
// to be kept in the same order by hand.
const SEVERITY_ORDER: readonly LogLevel[] = [
  'verbose',
  'debug',
  'log',
  'warn',
  'error',
  'fatal',
] as const;

// Production drops `debug` and `verbose` unless asked for them. Without this
// every WebSocket connect and disconnect, and every CloudFront signing, wrote a
// line in production with no way to turn it down — and `backend.md` already
// documented `LOG_LEVEL` as the way to do it, which made the documentation
// wrong rather than the behaviour merely noisy.
const PRODUCTION_DEFAULT: LogLevel = 'log';
const DEVELOPMENT_DEFAULT: LogLevel = 'verbose';

export function resolveLogLevels(
  rawLevel: string | undefined,
  nodeEnv: string | undefined,
): LogLevel[] {
  const fallback: LogLevel = nodeEnv === 'production' ? PRODUCTION_DEFAULT : DEVELOPMENT_DEFAULT;
  const requested: string = (rawLevel ?? fallback).trim().toLowerCase();
  const index: number = SEVERITY_ORDER.indexOf(requested as LogLevel);

  // Thrown, not defaulted. A typo that silently logs less than the operator
  // asked for is the worst outcome here: they believe they have debug output,
  // and the absence of it looks like the code never ran.
  if (index === -1) {
    throw new Error(
      `LOG_LEVEL must be one of ${SEVERITY_ORDER.join(', ')} — received "${rawLevel}".`,
    );
  }

  return [...SEVERITY_ORDER.slice(index)];
}
