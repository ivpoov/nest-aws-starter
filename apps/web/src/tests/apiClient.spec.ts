import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../stores/auth.store';
import { apiClient } from '../utils/apiClient';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('apiClient', () => {
  beforeEach(() => {
    useAuthStore.getState().clear();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends the bearer header on authenticated requests', async () => {
    useAuthStore.getState().setTokens('access-1', 'refresh-1');
    vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { ok: true }));

    await apiClient.get<{ ok: boolean }>('/sessions');

    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];

    expect((init.headers as Record<string, string>).authorization).toBe('Bearer access-1');
  });

  it('maps the backend error envelope to a thrown ApiError', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(409, { statusCode: 409, code: 'AUTH_EMAIL_TAKEN', details: 'taken' }),
    );

    const caught: unknown = await apiClient
      .post('/auth/register', {}, true)
      .then(() => null)
      .catch((error: unknown): unknown => error);

    expect(caught).toMatchObject({ statusCode: 409, code: 'AUTH_EMAIL_TAKEN' });
  });

  it('refreshes once on 401 and retries the original request', async () => {
    useAuthStore.getState().setTokens('stale', 'refresh-1');

    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL): Promise<Response> => {
      const url: string = String(input);

      if (url.endsWith('/auth/refresh')) {
        return jsonResponse(200, {
          accessToken: 'fresh',
          refreshToken: 'refresh-2',
          expiresInSec: 900,
        });
      }

      const isFresh: boolean = useAuthStore.getState().accessToken === 'fresh';

      return isFresh
        ? jsonResponse(200, { ok: true })
        : jsonResponse(401, { statusCode: 401, code: 'AUTH_TOKEN_INVALID', details: 'nope' });
    });

    const result: { ok: boolean } = await apiClient.get('/sessions');

    expect(result.ok).toBe(true);
    expect(useAuthStore.getState().refreshToken).toBe('refresh-2');
  });

  it('shares a single refresh between concurrent 401s', async () => {
    useAuthStore.getState().setTokens('stale', 'refresh-1');

    let refreshCalls = 0;

    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL): Promise<Response> => {
      const url: string = String(input);

      if (url.endsWith('/auth/refresh')) {
        refreshCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 20));

        return jsonResponse(200, {
          accessToken: 'fresh',
          refreshToken: 'refresh-2',
          expiresInSec: 900,
        });
      }

      const isFresh: boolean = useAuthStore.getState().accessToken === 'fresh';

      return isFresh
        ? jsonResponse(200, { ok: true })
        : jsonResponse(401, { statusCode: 401, code: 'AUTH_TOKEN_INVALID', details: 'nope' });
    });

    await Promise.all([
      apiClient.get('/sessions'),
      apiClient.get('/users/me'),
      apiClient.get('/notes'),
    ]);

    expect(refreshCalls).toBe(1);
  });

  it('clears the session when the refresh itself fails', async () => {
    useAuthStore.getState().setTokens('stale', 'refresh-dead');

    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL): Promise<Response> => {
      const url: string = String(input);

      if (url.endsWith('/auth/refresh')) {
        return jsonResponse(401, { statusCode: 401, code: 'AUTH_TOKEN_INVALID', details: 'no' });
      }

      return jsonResponse(401, { statusCode: 401, code: 'AUTH_TOKEN_INVALID', details: 'nope' });
    });

    await apiClient.get('/sessions').catch((): null => null);

    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().refreshToken).toBeNull();
  });
});
