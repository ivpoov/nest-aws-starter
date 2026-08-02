import type { LogEntryInterface } from '@modules/logger/interfaces/log-entry.interface.js';
import { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
import { RequestContextService } from '@modules/logger/services/request-context.service.js';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('CustomLoggerService', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('formats entries as parseable json with the standard fields', () => {
    const logger: CustomLoggerService = new CustomLoggerService('Ctx');

    const entry: LogEntryInterface = JSON.parse(logger.formatEntry('log', 'Ctx', 'msg'));

    expect(entry.level).toBe('log');
    expect(entry.context).toBe('Ctx');
    expect(entry.message).toBe('msg');
    expect(typeof entry.timestamp).toBe('string');
    expect(entry.requestId).toBeUndefined();
  });

  it('attaches requestId from the request context', () => {
    RequestContextService.run('abc-123', () => {
      const logger: CustomLoggerService = new CustomLoggerService('Ctx');

      const entry: LogEntryInterface = JSON.parse(logger.formatEntry('log', 'Ctx', 'msg'));

      expect(entry.requestId).toBe('abc-123');
    });
  });

  it('writes json lines to stdout in production', () => {
    vi.stubEnv('NODE_ENV', 'production');

    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const logger: CustomLoggerService = new CustomLoggerService('Ctx');

    logger.log('hello');

    expect(writeSpy).toHaveBeenCalledOnce();

    const line: string = String(writeSpy.mock.calls[0]?.[0]);
    const entry: LogEntryInterface = JSON.parse(line);

    expect(entry.level).toBe('log');
    expect(entry.message).toBe('hello');
  });
});
