import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { InternalError } from '@modules/common/errors/internal.error.js';
import { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
import { HttpClientService } from '@providers/http-client/services/http-client.service.js';
import { afterEach, describe, expect, it, vi } from 'vitest';

interface FixtureInterface {
  readonly url: string;
  readonly requests: () => number;
  readonly close: () => Promise<void>;
}

let activeServer: Server | null = null;

function startFixture(
  handler: (request: IncomingMessage, response: ServerResponse, attempt: number) => void,
): Promise<FixtureInterface> {
  let attempts = 0;
  const server: Server = createServer((request, response) => {
    attempts += 1;
    handler(request, response, attempts);
  });

  activeServer = server;

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;

      resolve({
        url: `http://127.0.0.1:${port}`,
        requests: (): number => attempts,
        close: (): Promise<void> =>
          new Promise((resolveClose) => server.close(() => resolveClose())),
      });
    });
  });
}

// Every log line the client writes is captured here, so an assertion can be
// made about the whole transcript rather than about one call's arguments.
const logged: string[] = [];

function captureLogs(): void {
  const record = (message: unknown): void => {
    logged.push(String(message));
  };

  vi.spyOn(CustomLoggerService.prototype, 'log').mockImplementation(record);
  vi.spyOn(CustomLoggerService.prototype, 'warn').mockImplementation(record);
}

afterEach(async () => {
  if (activeServer?.listening)
    await new Promise((resolve) => activeServer?.close(() => resolve(null)));

  activeServer = null;
  logged.length = 0;
  vi.restoreAllMocks();
});

describe('HttpClientService', () => {
  it('round-trips json bodies', async () => {
    const fixture: FixtureInterface = await startFixture((request, response) => {
      let raw = '';

      request.on('data', (chunk: Buffer) => {
        raw += chunk.toString();
      });
      request.on('end', () => {
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({ received: JSON.parse(raw) }));
      });
    });
    const client: HttpClientService = new HttpClientService();

    const result: { received: { ping: boolean } } = await client.request({
      method: 'POST',
      url: fixture.url,
      body: { ping: true },
    });

    expect(result).toEqual({ received: { ping: true } });
    await fixture.close();
  });

  it('aborts on timeout without retrying non-idempotent methods', async () => {
    const fixture: FixtureInterface = await startFixture((_request, response) => {
      setTimeout(() => response.end('{}'), 300);
    });
    const client: HttpClientService = new HttpClientService();

    await expect(
      client.request({ method: 'POST', url: fixture.url, timeoutMs: 50, retries: 2 }),
    ).rejects.toSatisfy(
      (caught: unknown): boolean =>
        caught instanceof InternalError && caught.args.code === 'HTTP_REQUEST_FAILED',
    );
    // The abort can race the fixture's request handler on a slow runner —
    // the rejection above already proves the client attempted the request;
    // this only guards against a retry (>1), not the exact abort timing.
    expect(fixture.requests()).toBeLessThanOrEqual(1);
    await fixture.close();
  });

  it('retries idempotent requests on 503 and then succeeds', async () => {
    const fixture: FixtureInterface = await startFixture((_request, response, attempt) => {
      if (attempt <= 2) {
        response.statusCode = 503;
        response.end();

        return;
      }

      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ ok: attempt }));
    });
    const client: HttpClientService = new HttpClientService();

    const result: { ok: number } = await client.request({
      method: 'GET',
      url: fixture.url,
      retries: 2,
    });

    expect(result).toEqual({ ok: 3 });
    expect(fixture.requests()).toBe(3);
    await fixture.close();
  });

  it('does not retry on 4xx and fails with the coded error', async () => {
    const fixture: FixtureInterface = await startFixture((_request, response) => {
      response.statusCode = 404;
      response.end();
    });
    const client: HttpClientService = new HttpClientService();

    await expect(client.request({ method: 'GET', url: fixture.url, retries: 2 })).rejects.toSatisfy(
      (caught: unknown): boolean =>
        caught instanceof InternalError && caught.args.code === 'HTTP_REQUEST_FAILED',
    );
    expect(fixture.requests()).toBe(1);
    await fixture.close();
  });

  // A query string is the one part of a URL that routinely carries client
  // secrets, access tokens and one-time codes. This client is the single choke
  // point every outbound call passes through, so redaction here is what stops a
  // future caller from silently reintroducing a credential leak into stdout —
  // and from there into CloudWatch, log-shipping vendors and support bundles.
  it('logs the origin and path only, never the query string', async () => {
    const fixture: FixtureInterface = await startFixture((_request, response) => {
      response.setHeader('content-type', 'application/json');
      response.end('{}');
    });

    captureLogs();

    const client: HttpClientService = new HttpClientService();

    await client.request({
      method: 'GET',
      url: `${fixture.url}/oauth/access_token?client_secret=top-secret&access_token=user-token`,
    });

    const transcript: string = logged.join('\n');

    expect(logged).toHaveLength(1);
    expect(transcript).toContain(`GET ${fixture.url}/oauth/access_token 200`);
    expect(transcript).not.toContain('?');
    expect(transcript).not.toContain('client_secret');
    expect(transcript).not.toContain('top-secret');
    expect(transcript).not.toContain('user-token');
    await fixture.close();
  });

  it('keeps the query string out of the failure log too', async () => {
    const fixture: FixtureInterface = await startFixture((_request, response) => {
      setTimeout(() => response.end('{}'), 300);
    });

    captureLogs();

    const client: HttpClientService = new HttpClientService();

    await expect(
      client.request({
        method: 'POST',
        url: `${fixture.url}/token?client_secret=top-secret`,
        timeoutMs: 50,
        retries: 0,
      }),
    ).rejects.toBeInstanceOf(InternalError);

    const transcript: string = logged.join('\n');

    expect(transcript).toContain(`POST ${fixture.url}/token failed`);
    expect(transcript).not.toContain('?');
    expect(transcript).not.toContain('top-secret');
    await fixture.close();
  });

  it('keeps the query string out of the download failure log', async () => {
    captureLogs();

    const client: HttpClientService = new HttpClientService();

    await expect(
      client.download('http://127.0.0.1:1/avatar.png?access_token=user-token', 10, ['image/png']),
    ).rejects.toBeInstanceOf(InternalError);

    const transcript: string = logged.join('\n');

    expect(transcript).toContain('GET http://127.0.0.1:1/avatar.png download failed');
    expect(transcript).not.toContain('?');
    expect(transcript).not.toContain('user-token');
  });

  // Redacting the URL is only half the job: the caught error is appended to the
  // same line, and fetch's own messages quote the offending URL verbatim —
  // userinfo, query string and all. Without sanitising the error text the
  // redaction above is undone by the suffix on the very same log line.
  it('redacts credentials that fetch echoes back inside the error message', async () => {
    captureLogs();

    const client: HttpClientService = new HttpClientService();

    await expect(
      client.request({
        method: 'POST',
        url: 'https://user:pa55word@127.0.0.1:1/oauth/access_token?client_secret=top-secret',
        retries: 0,
      }),
    ).rejects.toBeInstanceOf(InternalError);

    const transcript: string = logged.join('\n');

    expect(transcript).toContain('POST https://127.0.0.1:1/oauth/access_token failed');
    expect(transcript).not.toContain('pa55word');
    expect(transcript).not.toContain('client_secret');
    expect(transcript).not.toContain('top-secret');
  });

  it('redacts an unparseable url that the download error echoes back', async () => {
    captureLogs();

    const client: HttpClientService = new HttpClientService();

    await expect(
      client.download('graph.example/avatar.png?access_token=user-token', 10, ['image/png']),
    ).rejects.toBeInstanceOf(InternalError);

    const transcript: string = logged.join('\n');

    expect(transcript).toContain('[unparseable-url] download failed');
    expect(transcript).not.toContain('access_token');
    expect(transcript).not.toContain('user-token');
  });
});
