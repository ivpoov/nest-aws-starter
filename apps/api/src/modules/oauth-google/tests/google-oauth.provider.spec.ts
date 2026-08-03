import { googleOauthConfig } from '@configs/google-oauth.config.js';
import type { OauthProfileInterface } from '@modules/oauth/interfaces/oauth-profile.interface.js';
import { GoogleOauthProvider } from '@modules/oauth-google/providers/google-oauth.provider.js';
import type { HttpClientService } from '@providers/http-client/services/http-client.service.js';
import { afterEach, describe, expect, it, vi } from 'vitest';

const enabledConfig = {
  isEnabled: true as const,
  clientId: 'client-1',
  clientSecret: 'secret-1',
  redirectUri: 'http://localhost:3000/api/v1/auth/oauth/google/callback',
};

describe('googleOauthConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('skips all validation when disabled', () => {
    vi.stubEnv('GOOGLE_OAUTH_ENABLED', 'false');

    expect(googleOauthConfig()).toEqual({ isEnabled: false });
  });

  it('fails boot when enabled with missing variables', () => {
    vi.stubEnv('GOOGLE_OAUTH_ENABLED', 'true');
    vi.stubEnv('GOOGLE_OAUTH_CLIENT_ID', '');

    expect(() => googleOauthConfig()).toThrow(/Invalid configuration/);
  });

  it('accepts a complete enabled configuration', () => {
    vi.stubEnv('GOOGLE_OAUTH_ENABLED', 'true');
    vi.stubEnv('GOOGLE_OAUTH_CLIENT_ID', 'client-1');
    vi.stubEnv('GOOGLE_OAUTH_CLIENT_SECRET', 'secret-1');
    vi.stubEnv('GOOGLE_OAUTH_REDIRECT_URI', enabledConfig.redirectUri);

    expect(googleOauthConfig()).toMatchObject({ isEnabled: true, clientId: 'client-1' });
  });
});

describe('GoogleOauthProvider', () => {
  it('builds the consent url with all oauth params', () => {
    const provider: GoogleOauthProvider = new GoogleOauthProvider(
      enabledConfig,
      {} as HttpClientService,
    );
    const url: URL = new URL(provider.buildConsentUrl('state-123'));

    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('client_id')).toBe('client-1');
    expect(url.searchParams.get('state')).toBe('state-123');
    expect(url.searchParams.get('scope')).toBe('openid email profile');
  });

  it('exchanges the code and maps the profile from fixtures', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ access_token: 'ya29.token' })
      .mockResolvedValueOnce({
        sub: 'google-user-1',
        email: 'igor@example.com',
        email_verified: true,
        name: 'Igor',
        picture: 'https://lh3.example/photo.jpg',
      });
    const provider: GoogleOauthProvider = new GoogleOauthProvider(enabledConfig, {
      request,
    } as unknown as HttpClientService);

    const profile: OauthProfileInterface = await provider.exchangeCode('auth-code');

    expect(profile).toEqual({
      providerAccountId: 'google-user-1',
      email: 'igor@example.com',
      emailVerified: true,
      displayName: 'Igor',
      avatarUrl: 'https://lh3.example/photo.jpg',
    });
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[0]?.[0].url).toBe('https://oauth2.googleapis.com/token');
  });

  it('treats missing email_verified as unverified', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ access_token: 't' })
      .mockResolvedValueOnce({ sub: 'google-user-2' });
    const provider: GoogleOauthProvider = new GoogleOauthProvider(enabledConfig, {
      request,
    } as unknown as HttpClientService);

    const profile: OauthProfileInterface = await provider.exchangeCode('auth-code');

    expect(profile.emailVerified).toBe(false);
    expect(profile.email).toBeNull();
    expect(profile.displayName).toBe('Google user');
  });
});
