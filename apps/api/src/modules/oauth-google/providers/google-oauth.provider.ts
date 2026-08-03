import type { OauthProfileInterface } from '@modules/oauth/interfaces/oauth-profile.interface.js';
import type { OauthProviderInterface } from '@modules/oauth/interfaces/oauth-provider.interface.js';
import type { GoogleTokenResponseInterface } from '@modules/oauth-google/interfaces/google-token-response.interface.js';
import type { GoogleUserinfoInterface } from '@modules/oauth-google/interfaces/google-userinfo.interface.js';
import type { EnabledGoogleOauthConfigType } from '@modules/oauth-google/types/enabled-google-oauth-config.type.js';
import { AuthMethodTypeEnum } from '@nest-aws-starter/shared';
import { HttpClientService } from '@providers/http-client/services/http-client.service.js';

export class GoogleOauthProvider implements OauthProviderInterface {
  public readonly type = AuthMethodTypeEnum.GOOGLE;

  constructor(
    private readonly config: EnabledGoogleOauthConfigType,
    private readonly httpClient: HttpClientService,
  ) {}

  public buildConsentUrl(state: string): string {
    const url: URL = new URL('https://accounts.google.com/o/oauth2/v2/auth');

    url.searchParams.set('client_id', this.config.clientId);
    url.searchParams.set('redirect_uri', this.config.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('state', state);

    return url.toString();
  }

  public async exchangeCode(code: string): Promise<OauthProfileInterface> {
    const token: GoogleTokenResponseInterface =
      await this.httpClient.request<GoogleTokenResponseInterface>({
        method: 'POST',
        url: 'https://oauth2.googleapis.com/token',
        body: {
          code,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          redirect_uri: this.config.redirectUri,
          grant_type: 'authorization_code',
        },
      });
    const userinfo: GoogleUserinfoInterface =
      await this.httpClient.request<GoogleUserinfoInterface>({
        method: 'GET',
        url: 'https://openidconnect.googleapis.com/v1/userinfo',
        headers: { authorization: `Bearer ${token.access_token}` },
      });

    return {
      providerAccountId: userinfo.sub,
      email: userinfo.email ?? null,
      emailVerified: userinfo.email_verified === true,
      displayName: userinfo.name ?? userinfo.email ?? 'Google user',
      avatarUrl: userinfo.picture ?? null,
    };
  }
}
