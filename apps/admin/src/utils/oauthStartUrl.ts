const baseUrl: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:3000/api/v1';

export function oauthStartUrl(provider: string, intent: 'login' | 'link'): string {
  const redirect: string = `${window.location.origin}/auth/callback`;

  return `${baseUrl}/auth/oauth/${provider.toLowerCase()}/start?intent=${intent}&redirect=${encodeURIComponent(redirect)}`;
}
