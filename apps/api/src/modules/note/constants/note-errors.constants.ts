import type { ErrorArgsInterface } from '@interfaces/error-args.interface.js';

export const NOTE_NOT_FOUND: ErrorArgsInterface = {
  code: 'NOTE_NOT_FOUND',
  details: 'Note not found',
};

export const NOTE_ACCESS_DENIED: ErrorArgsInterface = {
  code: 'NOTE_ACCESS_DENIED',
  details: 'This note belongs to another user',
};
