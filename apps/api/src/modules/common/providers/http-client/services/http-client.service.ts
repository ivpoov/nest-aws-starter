import { InternalError } from '@modules/common/errors/internal.error.js';
import { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
import { Injectable } from '@nestjs/common';
import {
  BACKOFF_BASE_MS,
  DEFAULT_RETRIES,
  DEFAULT_TIMEOUT_MS,
  IDEMPOTENT_METHODS,
} from '@providers/http-client/constants/http-client.constants.js';
import { HTTP_REQUEST_FAILED } from '@providers/http-client/constants/http-client-errors.constants.js';
import type { HttpRequestOptionsInterface } from '@providers/http-client/interfaces/http-request-options.interface.js';
import type { HttpRequestOutcomeType } from '@providers/http-client/types/http-request-outcome.type.js';

@Injectable()
export class HttpClientService {
  private readonly logger = new CustomLoggerService(HttpClientService.name);

  public async request<T>(options: HttpRequestOptionsInterface): Promise<T> {
    const retries: number = options.retries ?? DEFAULT_RETRIES;
    const isIdempotent: boolean = IDEMPOTENT_METHODS.includes(options.method);
    const maxAttempts: number = isIdempotent ? retries + 1 : 1;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      if (attempt > 0) await this.pause(BACKOFF_BASE_MS * 2 ** (attempt - 1));

      const outcome: HttpRequestOutcomeType<T> = await this.performRequest<T>(options);

      if (outcome.ok) return outcome.data;

      if (!outcome.retryable) break;
    }

    throw new InternalError(HTTP_REQUEST_FAILED);
  }

  private async performRequest<T>(
    options: HttpRequestOptionsInterface,
  ): Promise<HttpRequestOutcomeType<T>> {
    const startedAt: number = Date.now();

    try {
      const response: Response = await fetch(options.url, {
        method: options.method,
        signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
        headers: { 'content-type': 'application/json', ...options.headers },
        ...(options.body !== undefined && { body: JSON.stringify(options.body) }),
      });

      this.logger.log(
        `${options.method} ${options.url} ${response.status} ${Date.now() - startedAt}ms`,
      );

      if (!response.ok) {
        return { ok: false, status: response.status, retryable: response.status >= 500 };
      }

      return { ok: true, data: await this.parseBody<T>(response) };
    } catch (caught) {
      this.logger.warn(
        `${options.method} ${options.url} failed after ${Date.now() - startedAt}ms: ${String(caught)}`,
      );

      return { ok: false, status: null, retryable: true };
    }
  }

  private async parseBody<T>(response: Response): Promise<T> {
    const raw: string = await response.text();

    return raw === '' ? (undefined as T) : (JSON.parse(raw) as T);
  }

  private pause(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
