import { resolveLogLevels } from '@modules/logger/helpers/resolve-log-levels.helper.js';
import { describe, expect, it } from 'vitest';

describe('resolveLogLevels', () => {
  // The whole point of the change: production was shipping debug and verbose
  // because nothing ever set a level, while backend.md said LOG_LEVEL turned
  // them off.
  it('drops debug and verbose in production when no level is set', () => {
    expect(resolveLogLevels(undefined, 'production')).toEqual(['log', 'warn', 'error', 'fatal']);
  });

  it('keeps every level outside production when no level is set', () => {
    expect(resolveLogLevels(undefined, 'development')).toEqual([
      'verbose',
      'debug',
      'log',
      'warn',
      'error',
      'fatal',
    ]);
  });

  // A minimum severity, not an exact match — asking for warn must still show
  // errors, or raising the level would hide the things you raised it to see.
  it('enables the requested level and everything more severe', () => {
    expect(resolveLogLevels('warn', 'production')).toEqual(['warn', 'error', 'fatal']);
  });

  it('lets production ask for debug explicitly', () => {
    expect(resolveLogLevels('debug', 'production')).toEqual([
      'debug',
      'log',
      'warn',
      'error',
      'fatal',
    ]);
  });

  it('accepts a level whatever its casing or surrounding space', () => {
    expect(resolveLogLevels('  WARN ', 'production')).toEqual(['warn', 'error', 'fatal']);
  });

  // Loud, not lenient. Defaulting a typo would leave an operator believing
  // they had debug output, and its absence looks like the code never ran.
  it('refuses a level it does not recognise', () => {
    expect(() => resolveLogLevels('trace', 'production')).toThrow(/LOG_LEVEL must be one of/);
  });
});
