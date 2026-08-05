import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { InternalError } from '@modules/common/errors/internal.error.js';
import { HttpClientService } from '@providers/http-client/services/http-client.service.js';
import { afterEach, describe, expect, it } from 'vitest';

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

afterEach(async () => {
  if (activeServer?.listening)
    await new Promise((resolve) => activeServer?.close(() => resolve(null)));

  activeServer = null;
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
});
