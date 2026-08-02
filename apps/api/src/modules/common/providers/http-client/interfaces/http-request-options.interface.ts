import type { HttpMethodType } from '@providers/http-client/types/http-method.type.js';

export interface HttpRequestOptionsInterface {
  readonly method: HttpMethodType;
  readonly url: string;
  readonly body?: object | undefined;
  readonly headers?: Record<string, string> | undefined;
  readonly timeoutMs?: number | undefined;
  readonly retries?: number | undefined;
}
