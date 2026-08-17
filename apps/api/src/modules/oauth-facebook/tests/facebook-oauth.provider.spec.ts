import { facebookOauthConfig } from '@configs/facebook-oauth.config.js';
import type { OauthProfileInterface } from '@modules/oauth/interfaces/oauth-profile.interface.js';
import { FacebookOauthProvider } from '@modules/oauth-facebook/providers/facebook-oauth.provider.js';
import type { HttpClientService } from '@providers/http-client/services/http-client.service.js';
import { afterEach, describe, expect, it, vi } from 'vitest';

const enabledConfig = {
  isEnabled: true as const,
  clientId: 'fb-client',
  clientSecret: 'fb-secret',
  redirectUri: 'http://localhost:3000/api/v1/auth/oauth/facebook/callback',
};

describe('facebookOauthConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('skips all validation when disabled', () => {
    vi.stubEnv('FACEBOOK_OAUTH_ENABLED', 'false');

    expect(facebookOauthConfig()).toEqual({ isEnabled: false });
  });

  it('fails boot when enabled with missing variables', () => {
    vi.stubEnv('FACEBOOK_OAUTH_ENABLED', 'true');
    vi.stubEnv('FACEBOOK_OAUTH_CLIENT_ID', '');

    expect(() => facebookOauthConfig()).toThrow(/Invalid configuration/);
  });
});

describe('FacebookOauthProvider', () => {
  it('builds the consent url with all oauth params', () => {
    const provider: FacebookOauthProvider = new FacebookOauthProvider(
      enabledConfig,
      {} as HttpClientService,
    );
    const url: URL = new URL(provider.buildConsentUrl('state-9'));

    expect(url.origin + url.pathname).toBe('https://www.facebook.com/v23.0/dialog/oauth');
    expect(url.searchParams.get('client_id')).toBe('fb-client');
    expect(url.searchParams.get('state')).toBe('state-9');
    expect(url.searchParams.get('scope')).toBe('email,public_profile');
  });

  it('exchanges the code and maps the profile from fixtures', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ access_token: 'fb-token' })
      .mockResolvedValueOnce({
        id: 'fb-user-1',
        name: 'Igor',
        email: 'igor@example.com',
        picture: { data: { url: 'https://graph.example/photo.jpg' } },
      });
    const provider: FacebookOauthProvider = new FacebookOauthProvider(enabledConfig, {
      request,
    } as unknown as HttpClientService);

    const profile: OauthProfileInterface = await provider.exchangeCode('fb-code');

    expect(profile).toEqual({
      providerAccountId: 'fb-user-1',
      email: 'igor@example.com',
      emailVerified: true,
      displayName: 'Igor',
      avatarUrl: 'https://graph.example/photo.jpg',
    });

    const tokenUrl: URL = new URL(request.mock.calls[0]?.[0].url);

    expect(tokenUrl.pathname).toBe('/v23.0/oauth/access_token');
    // Form body, not query string — see the credential test below.
    expect(request.mock.calls[0]?.[0].method).toBe('POST');
    expect(request.mock.calls[0]?.[0].form.code).toBe('fb-code');
  });

  // The app secret and the user's access token used to travel as search
  // params, which the HTTP client wrote to stdout on every login. Both now
  // move the way Google and Discord move them: the secret in the POST form
  // body, the token in an Authorization header. Asserted on the URLs rather
  // than on the logger so the provider cannot regress independently of the
  // client's redaction.
  it('never puts the client secret or the access token in a url', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ access_token: 'fb-token' })
      .mockResolvedValueOnce({ id: 'fb-user-3', name: 'Igor' });
    const provider: FacebookOauthProvider = new FacebookOauthProvider(enabledConfig, {
      request,
    } as unknown as HttpClientService);

    await provider.exchangeCode('fb-code');

    // `vi.fn()` records its arguments as `any[]`, so the first one is narrowed
    // here rather than declared as a tuple the recorded type cannot satisfy.
    const urls: string = request.mock.calls
      .map((call: unknown[]): string => (call[0] as { url: string }).url)
      .join('\n');

    expect(urls).not.toContain('fb-secret');
    expect(urls).not.toContain('client_secret');
    expect(urls).not.toContain('fb-token');
    expect(urls).not.toContain('access_token=');

    expect(request.mock.calls[0]?.[0].form.client_secret).toBe('fb-secret');
    expect(request.mock.calls[1]?.[0].headers.authorization).toBe('Bearer fb-token');
    expect(new URL(request.mock.calls[1]?.[0].url).searchParams.get('fields')).toBe(
      'id,name,email,picture.type(large)',
    );
  });

  it('treats a withheld email as unverified and absent', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ access_token: 't' })
      .mockResolvedValueOnce({ id: 'fb-user-2', name: 'No Email' });
    const provider: FacebookOauthProvider = new FacebookOauthProvider(enabledConfig, {
      request,
    } as unknown as HttpClientService);

    const profile: OauthProfileInterface = await provider.exchangeCode('fb-code');

    expect(profile.email).toBeNull();
    expect(profile.emailVerified).toBe(false);
  });
});
