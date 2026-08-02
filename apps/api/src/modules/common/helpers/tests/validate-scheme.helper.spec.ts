import { validateScheme } from '@helpers/validate-scheme.helper.js';
import { Logger } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

describe('validateScheme', () => {
  it('throws when config does not match the scheme', () => {
    const scheme = z.object({ port: z.number() });
    const logger: Logger = new Logger('Test');

    vi.spyOn(logger, 'error').mockImplementation(() => undefined);

    expect(() => validateScheme(scheme, { port: 'oops' }, logger)).toThrow(/Invalid configuration/);
    expect(logger.error).toHaveBeenCalledOnce();
  });

  it('passes silently on valid config', () => {
    const scheme = z.object({ port: z.number() });
    const logger: Logger = new Logger('Test');

    expect(() => validateScheme(scheme, { port: 3000 }, logger)).not.toThrow();
  });
});
