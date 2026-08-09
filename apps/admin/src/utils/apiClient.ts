import type { AuthTokensResponseInterface } from '@nest-aws-starter/shared';
import type { RequestOptionsInterface } from '../interfaces/request-options.interface';
import { useAuthStore } from '../stores/auth.store';

const baseUrl: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:3000/api/v1';

// Single-flight: concurrent 401s share one refresh request.
let refreshInFlight: Promise<boolean> | null = null;

async function performRequest<T>(
  options: RequestOptionsInterface,
  retryOn401: boolean,
): Promise<T> {
  const accessToken: string | null = useAuthStore.getState().accessToken;
  const response: Response = await fetch(`${baseUrl}${options.path}`, {
    method: options.method,
    headers: {
      ...(options.body !== undefined && { 'content-type': 'application/json' }),
      ...(!options.isPublic && accessToken && { authorization: `Bearer ${accessToken}` }),
    },
    ...(options.body !== undefined && { body: JSON.stringify(options.body) }),
  });

  if (response.status === 401 && !options.isPublic && retryOn401) {
    const isRefreshed: boolean = await refreshTokens();

    if (isRefreshed) return performRequest<T>(options, false);

    useAuthStore.getState().clear();
  }

  if (!response.ok) throw await response.json();

  const raw: string = await response.text();

  return raw === '' ? (undefined as T) : (JSON.parse(raw) as T);
}

async function refreshTokens(): Promise<boolean> {
  refreshInFlight ??= requestRefresh().finally((): void => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

async function requestRefresh(): Promise<boolean> {
  const refreshToken: string | null = useAuthStore.getState().refreshToken;

  if (!refreshToken) return false;

  const response: Response = await fetch(`${baseUrl}/auth/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) return false;

  const tokens: AuthTokensResponseInterface = await response.json();

  useAuthStore.getState().setTokens(tokens.accessToken, tokens.refreshToken);

  return true;
}

export const apiClient = {
  get<T>(path: string, isPublic: boolean = false): Promise<T> {
    return performRequest<T>({ method: 'GET', path, isPublic }, true);
  },
  post<T>(path: string, body?: unknown, isPublic: boolean = false): Promise<T> {
    return performRequest<T>({ method: 'POST', path, body, isPublic }, true);
  },
  patch<T>(path: string, body: unknown): Promise<T> {
    return performRequest<T>({ method: 'PATCH', path, body }, true);
  },
  delete<T>(path: string): Promise<T> {
    return performRequest<T>({ method: 'DELETE', path }, true);
  },
  // Presigned S3 upload — the one non-API fetch, still owned by apiClient.
  async uploadToUrl(url: string, body: Blob, contentType: string): Promise<void> {
    const response: Response = await fetch(url, {
      method: 'PUT',
      headers: { 'content-type': contentType },
      body,
    });

    if (!response.ok) throw new Error(`Upload failed: ${response.status}`);
  },
};
