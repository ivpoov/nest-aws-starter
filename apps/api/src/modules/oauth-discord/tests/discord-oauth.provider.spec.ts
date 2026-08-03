import { discordOauthConfig } from '@configs/discord-oauth.config.js';
import type { OauthProfileInterface } from '@modules/oauth/interfaces/oauth-profile.interface.js';
import { DiscordOauthProvider } from '@modules/oauth-discord/providers/discord-oauth.provider.js';
import type { HttpClientService } from '@providers/http-client/services/http-client.service.js';
import { afterEach, describe, expect, it, vi } from 'vitest';

const enabledConfig = {
  isEnabled: true as const,
  clientId: 'discord-client',
  clientSecret: 'discord-secret',
  redirectUri: 'http://localhost:3000/api/v1/auth/oauth/discord/callback',
};

describe('discordOauthConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('skips all validation when disabled', () => {
    vi.stubEnv('DISCORD_OAUTH_ENABLED', 'false');

    expect(discordOauthConfig()).toEqual({ isEnabled: false });
  });

  it('fails boot when enabled with missing variables', () => {
    vi.stubEnv('DISCORD_OAUTH_ENABLED', 'true');
    vi.stubEnv('DISCORD_OAUTH_CLIENT_ID', '');

    expect(() => discordOauthConfig()).toThrow(/Invalid configuration/);
  });
});

describe('DiscordOauthProvider', () => {
  it('builds the consent url with all oauth params', () => {
    const provider: DiscordOauthProvider = new DiscordOauthProvider(
      enabledConfig,
      {} as HttpClientService,
    );
    const url: URL = new URL(provider.buildConsentUrl('state-d'));

    expect(url.origin + url.pathname).toBe('https://discord.com/oauth2/authorize');
    expect(url.searchParams.get('scope')).toBe('identify email');
    expect(url.searchParams.get('state')).toBe('state-d');
  });

  it('exchanges the code form-encoded and maps the profile', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ access_token: 'discord-token' })
      .mockResolvedValueOnce({
        id: 'discord-user-1',
        username: 'igor',
        global_name: 'Igor',
        email: 'igor@example.com',
        verified: true,
        avatar: 'abc123',
      });
    const provider: DiscordOauthProvider = new DiscordOauthProvider(enabledConfig, {
      request,
    } as unknown as HttpClientService);

    const profile: OauthProfileInterface = await provider.exchangeCode('discord-code');

    expect(profile).toEqual({
      providerAccountId: 'discord-user-1',
      email: 'igor@example.com',
      emailVerified: true,
      displayName: 'Igor',
      avatarUrl: 'https://cdn.discordapp.com/avatars/discord-user-1/abc123.png',
    });
    expect(request.mock.calls[0]?.[0].form?.grant_type).toBe('authorization_code');
  });

  it('falls back to the username and no avatar', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ access_token: 't' })
      .mockResolvedValueOnce({ id: 'discord-user-2', username: 'plain' });
    const provider: DiscordOauthProvider = new DiscordOauthProvider(enabledConfig, {
      request,
    } as unknown as HttpClientService);

    const profile: OauthProfileInterface = await provider.exchangeCode('discord-code');

    expect(profile.displayName).toBe('plain');
    expect(profile.avatarUrl).toBeNull();
    expect(profile.emailVerified).toBe(false);
  });
});
