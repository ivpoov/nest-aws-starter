import type { HttpMethodType } from '@providers/http-client/types/http-method.type.js';

export const DEFAULT_TIMEOUT_MS = 10_000;
export const DEFAULT_RETRIES = 2;
export const BACKOFF_BASE_MS = 200;
export const IDEMPOTENT_METHODS: readonly HttpMethodType[] = ['GET', 'HEAD', 'PUT', 'DELETE'];
