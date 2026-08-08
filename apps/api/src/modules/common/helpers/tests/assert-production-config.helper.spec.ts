import { assertProductionConfig } from '@helpers/assert-production-config.helper.js';
import type { Logger } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

const STRONG_SECRET =
  'd75e83775009476bd493d89108682e707d62a9e0dca64ac74fd297cd5b57587f04caa4a28936b6417e345ebeb99e585e';

function createLogger(): Logger {
  return { error: vi.fn() } as unknown as Logger;
}

describe('assertProductionConfig', () => {
  it('returns quietly when nothing is wrong', () => {
    const logger: Logger = createLogger();

    expect(() =>
      assertProductionConfig(
        { AUTH_JWT_SECRET: STRONG_SECRET, CORS_ORIGINS: 'https://app.example.com' },
        logger,
      ),
    ).not.toThrow();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('throws one message listing every violation, and logs the same report', () => {
    const logger: Logger = createLogger();

    expect(() =>
      assertProductionConfig(
        {
          AUTH_JWT_SECRET: 'local-development-secret-change-me-32chars',
          CORS_ORIGINS: 'http://localhost:5173',
          SWAGGER_ENABLED: 'true',
        },
        logger,
      ),
    ).toThrow(/Refusing to boot with NODE_ENV=production — 4 unsafe configuration value\(s\)/);
    expect(logger.error).toHaveBeenCalledTimes(1);
  });
});
