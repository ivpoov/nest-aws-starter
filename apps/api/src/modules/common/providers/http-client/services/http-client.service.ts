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
import type { HttpDownloadResultInterface } from '@providers/http-client/interfaces/http-download-result.interface.js';
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

  public async download(
    url: string,
    maxBytes: number,
    allowedContentTypes: readonly string[],
  ): Promise<HttpDownloadResultInterface> {
    const response: Response = await fetch(url, {
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    }).catch((caught: unknown): never => {
      this.logger.warn(`GET ${url} download failed: ${String(caught)}`);

      throw new InternalError(HTTP_REQUEST_FAILED);
    });
    const contentType: string = response.headers.get('content-type') ?? '';

    if (!response.ok || !allowedContentTypes.includes(contentType.split(';')[0] ?? '')) {
      throw new InternalError(HTTP_REQUEST_FAILED);
    }

    const body: Buffer = Buffer.from(await response.arrayBuffer());

    if (body.byteLength > maxBytes) throw new InternalError(HTTP_REQUEST_FAILED);

    return { contentType: contentType.split(';')[0] ?? contentType, body };
  }

  private async performRequest<T>(
    options: HttpRequestOptionsInterface,
  ): Promise<HttpRequestOutcomeType<T>> {
    const startedAt: number = Date.now();

    try {
      const response: Response = await fetch(options.url, {
        method: options.method,
        signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
        headers: {
          'content-type':
            options.form !== undefined ? 'application/x-www-form-urlencoded' : 'application/json',
          ...options.headers,
        },
        ...(options.form !== undefined
          ? { body: new URLSearchParams(options.form).toString() }
          : options.body !== undefined && { body: JSON.stringify(options.body) }),
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
