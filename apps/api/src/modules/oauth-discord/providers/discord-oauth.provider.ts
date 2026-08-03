import type { OauthProfileInterface } from '@modules/oauth/interfaces/oauth-profile.interface.js';
import type { OauthProviderInterface } from '@modules/oauth/interfaces/oauth-provider.interface.js';
import type { DiscordTokenResponseInterface } from '@modules/oauth-discord/interfaces/discord-token-response.interface.js';
import type { DiscordUserResponseInterface } from '@modules/oauth-discord/interfaces/discord-user-response.interface.js';
import type { EnabledDiscordOauthConfigType } from '@modules/oauth-discord/types/enabled-discord-oauth-config.type.js';
import { AuthMethodTypeEnum } from '@nest-aws-starter/shared';
import { HttpClientService } from '@providers/http-client/services/http-client.service.js';

export class DiscordOauthProvider implements OauthProviderInterface {
  public readonly type = AuthMethodTypeEnum.DISCORD;

  constructor(
    private readonly config: EnabledDiscordOauthConfigType,
    private readonly httpClient: HttpClientService,
  ) {}

  public buildConsentUrl(state: string): string {
    const url: URL = new URL('https://discord.com/oauth2/authorize');

    url.searchParams.set('client_id', this.config.clientId);
    url.searchParams.set('redirect_uri', this.config.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'identify email');
    url.searchParams.set('state', state);

    return url.toString();
  }

  public async exchangeCode(code: string): Promise<OauthProfileInterface> {
    const token: DiscordTokenResponseInterface =
      await this.httpClient.request<DiscordTokenResponseInterface>({
        method: 'POST',
        url: 'https://discord.com/api/oauth2/token',
        // OAuth token endpoints require form encoding (RFC 6749 §4.1.3)
        form: {
          code,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          redirect_uri: this.config.redirectUri,
          grant_type: 'authorization_code',
        },
      });
    const user: DiscordUserResponseInterface =
      await this.httpClient.request<DiscordUserResponseInterface>({
        method: 'GET',
        url: 'https://discord.com/api/users/@me',
        headers: { authorization: `Bearer ${token.access_token}` },
      });

    return {
      providerAccountId: user.id,
      email: user.email ?? null,
      emailVerified: user.verified === true,
      displayName: user.global_name ?? user.username,
      avatarUrl: user.avatar
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
        : null,
    };
  }
}
