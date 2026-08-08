import { collectProductionViolations } from '@helpers/collect-production-violations.helper.js';
import type { ErrorArgsInterface } from '@interfaces/error-args.interface.js';
import type { Logger } from '@nestjs/common';

// Fails at boot, never at first use — the same contract the optional-provider
// configs follow. Throwing from a config factory aborts module resolution, so
// the process never reaches app.listen() with an unsafe secret in memory.
export function assertProductionConfig(env: NodeJS.ProcessEnv, logger: Logger): void {
  const violations: ErrorArgsInterface[] = collectProductionViolations(env);

  if (violations.length === 0) return;

  const report: string = violations
    .map((violation: ErrorArgsInterface): string => `  - [${violation.code}] ${violation.details}`)
    .join('\n');

  logger.error(`Refusing to boot with NODE_ENV=production:\n${report}`);

  throw new Error(
    `Refusing to boot with NODE_ENV=production — ${violations.length} unsafe configuration value(s):\n${report}`,
  );
}
