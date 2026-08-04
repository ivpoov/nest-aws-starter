import type { ApiErrorInterface } from '@nest-aws-starter/shared';

// For failures caught client-side, before any request reaches the backend
// (or after a presigned URL fails outside apiClient's own error mapping) —
// shaped like the backend envelope so callers only ever branch on one type.
export function buildClientError(code: string, details: string): ApiErrorInterface {
  return { statusCode: 0, code, details, meta: undefined, timestamp: '', path: '' };
}
