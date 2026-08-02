import { ConflictError } from '@modules/common/errors/conflict.error.js';
import { NotFoundError } from '@modules/common/errors/not-found.error.js';
import { AllExceptionsFilter } from '@modules/common/filters/all-exceptions.filter.js';
import { type ArgumentsHost, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

interface SentResponseInterface {
  readonly statusCode: number;
  readonly body: {
    readonly statusCode: number;
    readonly code: string;
    readonly details: string;
    readonly timestamp: string;
    readonly path: string;
  };
}

function catchException(exception: unknown): SentResponseInterface {
  const filter: AllExceptionsFilter = new AllExceptionsFilter();
  const send = vi.fn();
  const status = vi.fn().mockReturnValue({ send });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ url: '/api/v1/test' }),
    }),
  } as unknown as ArgumentsHost;

  filter.catch(exception, host);

  return {
    statusCode: status.mock.calls[0]?.[0] as number,
    body: send.mock.calls[0]?.[0] as SentResponseInterface['body'],
  };
}

describe('AllExceptionsFilter', () => {
  it('maps domain not-found errors to 404 with their code', () => {
    const result: SentResponseInterface = catchException(
      new NotFoundError({ code: 'NOTE_NOT_FOUND', details: 'Note not found' }),
    );

    expect(result.statusCode).toBe(404);
    expect(result.body.code).toBe('NOTE_NOT_FOUND');
    expect(result.body.details).toBe('Note not found');
    expect(result.body.path).toBe('/api/v1/test');
  });

  it('maps domain conflict errors to 409', () => {
    const result: SentResponseInterface = catchException(
      new ConflictError({ code: 'NOTE_TITLE_TAKEN', details: 'Title already used' }),
    );

    expect(result.statusCode).toBe(409);
    expect(result.body.code).toBe('NOTE_TITLE_TAKEN');
  });

  it('maps edge http exceptions to a status-derived generic code', () => {
    const result: SentResponseInterface = catchException(new NotFoundException('missing'));

    expect(result.statusCode).toBe(404);
    expect(result.body.code).toBe('NOT_FOUND');
    expect(result.body.details).toBe('missing');
  });

  it('maps unknown errors to the internal code and logs them', () => {
    const result: SentResponseInterface = catchException(new Error('boom'));

    expect(result.statusCode).toBe(500);
    expect(result.body.code).toBe('INTERNAL_SERVER_ERROR');
    expect(result.body.details).toBe('Internal server error');
  });
});
