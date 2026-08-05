import { validateScheme } from '@helpers/validate-scheme.helper.js';
import { Logger } from '@nestjs/common';
import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const scheme = z.object({
  isEnabled: z.boolean(),
});

export type SchedulerConfig = Required<z.infer<typeof scheme>>;

// Opt-out, not opt-in: cron scheduling defaults on in every environment
// except where explicitly disabled (e2e, to keep suites deterministic and
// noise-free while no production jobs are wired yet).
export const schedulerConfig = registerAs('scheduler', (): SchedulerConfig => {
  const config: SchedulerConfig = {
    isEnabled: process.env.SCHEDULER_ENABLED !== 'false',
  };

  validateScheme(scheme, config, new Logger('SchedulerConfig'));

  return config;
});
