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
      this.logger.warn(
        `GET ${this.redactUrl(url)} download failed: ${this.redactMessage(String(caught))}`,
      );

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
        `${options.method} ${this.redactUrl(options.url)} ${response.status} ${Date.now() - startedAt}ms`,
      );

      if (!response.ok) {
        return { ok: false, status: response.status, retryable: response.status >= 500 };
      }

      return { ok: true, data: await this.parseBody<T>(response) };
    } catch (caught) {
      this.logger.warn(
        `${options.method} ${this.redactUrl(options.url)} failed after ${Date.now() - startedAt}ms: ${this.redactMessage(String(caught))}`,
      );

      return { ok: false, status: null, retryable: true };
    }
  }

  private async parseBody<T>(response: Response): Promise<T> {
    const raw: string = await response.text();

    return raw === '' ? (undefined as T) : (JSON.parse(raw) as T);
  }

  // Origin and path only — the query string never reaches a log line. Callers
  // put client secrets, access tokens and one-time codes in search params
  // (several OAuth providers document exactly that), and this service is the
  // single choke point every outbound request passes through, so redacting
  // here protects every present and future caller rather than one of them.
  // Conventions: "never log secrets, tokens, passwords, or raw bodies of auth
  // endpoints" (docs/conventions/backend.md).
  private redactUrl(rawUrl: string): string {
    if (!URL.canParse(rawUrl)) return '[unparseable-url]';

    const parsed: URL = new URL(rawUrl);

    return `${parsed.origin}${parsed.pathname}`;
  }

  // The caught error is appended to the same line the URL was redacted on, and
  // fetch quotes the offending URL back verbatim — `Request cannot be
  // constructed from a URL that includes credentials: https://user:pw@host/p?
  // client_secret=…`, `Failed to parse URL from host/p?client_secret=…`. So
  // the message is sanitised as well, or the suffix simply undoes the prefix.
  //
  // Deliberately blunt: any `user:pass@` before a host is dropped, and any run
  // of non-space characters after a `?` is treated as a query string and
  // dropped with it. A false positive costs a few characters of an error
  // message; a false negative costs a credential.
  private redactMessage(text: string): string {
    return text.replace(/(:\/\/)[^/\s@]*@/g, '$1[redacted]@').replace(/\?\S+/g, '?[redacted]');
  }

  private pause(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
