import type { ErrorArgsInterface } from '@interfaces/error-args.interface.js';

/**
 * Framework-generic error args. Feature modules NEVER add codes here — each module
 * owns its errors in `modules/<name>/constants/<name>-errors.constants.ts`, with
 * string codes prefixed by the module name (`NOTE_NOT_FOUND`). Deleting a module
 * deletes its codes; global uniqueness is enforced by the error-codes spec.
 *
 * Services throw domain errors (`NotFoundError`, `ConflictError`, …) carrying these
 * args — never transport exceptions. Transport filters map categories to protocol
 * statuses at the edge.
 */
export const INTERNAL_SERVER_ERROR: ErrorArgsInterface = {
  code: 'INTERNAL_SERVER_ERROR',
  details: 'Internal server error',
};
