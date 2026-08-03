import type { OauthProfileInterface } from '@modules/oauth/interfaces/oauth-profile.interface.js';
import type { OauthProviderInterface } from '@modules/oauth/interfaces/oauth-provider.interface.js';
import type { FacebookProfileResponseInterface } from '@modules/oauth-facebook/interfaces/facebook-profile-response.interface.js';
import type { FacebookTokenResponseInterface } from '@modules/oauth-facebook/interfaces/facebook-token-response.interface.js';
import type { EnabledFacebookOauthConfigType } from '@modules/oauth-facebook/types/enabled-facebook-oauth-config.type.js';
import { AuthMethodTypeEnum } from '@nest-aws-starter/shared';
import { HttpClientService } from '@providers/http-client/services/http-client.service.js';

const GRAPH_BASE = 'https://graph.facebook.com/v23.0';

export class FacebookOauthProvider implements OauthProviderInterface {
  public readonly type = AuthMethodTypeEnum.FACEBOOK;

  constructor(
    private readonly config: EnabledFacebookOauthConfigType,
    private readonly httpClient: HttpClientService,
  ) {}

  public buildConsentUrl(state: string): string {
    const url: URL = new URL('https://www.facebook.com/v23.0/dialog/oauth');

    url.searchParams.set('client_id', this.config.clientId);
    url.searchParams.set('redirect_uri', this.config.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'email,public_profile');
    url.searchParams.set('state', state);

    return url.toString();
  }

  public async exchangeCode(code: string): Promise<OauthProfileInterface> {
    const tokenUrl: URL = new URL(`${GRAPH_BASE}/oauth/access_token`);

    tokenUrl.searchParams.set('client_id', this.config.clientId);
    tokenUrl.searchParams.set('client_secret', this.config.clientSecret);
    tokenUrl.searchParams.set('redirect_uri', this.config.redirectUri);
    tokenUrl.searchParams.set('code', code);

    const token: FacebookTokenResponseInterface =
      await this.httpClient.request<FacebookTokenResponseInterface>({
        method: 'GET',
        url: tokenUrl.toString(),
      });
    const profileUrl: URL = new URL(`${GRAPH_BASE}/me`);

    profileUrl.searchParams.set('fields', 'id,name,email,picture.type(large)');
    profileUrl.searchParams.set('access_token', token.access_token);

    const profile: FacebookProfileResponseInterface =
      await this.httpClient.request<FacebookProfileResponseInterface>({
        method: 'GET',
        url: profileUrl.toString(),
      });

    return {
      providerAccountId: profile.id,
      email: profile.email ?? null,
      // Facebook only returns confirmed addresses on the email permission.
      emailVerified: profile.email !== undefined,
      displayName: profile.name ?? profile.email ?? 'Facebook user',
      avatarUrl: profile.picture?.data?.url ?? null,
    };
  }
}
