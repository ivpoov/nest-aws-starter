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

  // Facebook documents both of these calls with the credentials in the query
  // string, and both are accepted the way Google and Discord do it instead: a
  // URL is logged, cached by proxies and kept in browser and server history,
  // so the app secret goes in the POST form body and the user's access token
  // in an Authorization header. Only `fields` — which is not a secret —
  // remains a search param.
  public async exchangeCode(code: string): Promise<OauthProfileInterface> {
    const token: FacebookTokenResponseInterface =
      await this.httpClient.request<FacebookTokenResponseInterface>({
        method: 'POST',
        url: `${GRAPH_BASE}/oauth/access_token`,
        // OAuth token endpoints require form encoding (RFC 6749 §4.1.3)
        form: {
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          redirect_uri: this.config.redirectUri,
          code,
        },
      });
    const profileUrl: URL = new URL(`${GRAPH_BASE}/me`);

    profileUrl.searchParams.set('fields', 'id,name,email,picture.type(large)');

    const profile: FacebookProfileResponseInterface =
      await this.httpClient.request<FacebookProfileResponseInterface>({
        method: 'GET',
        url: profileUrl.toString(),
        headers: { authorization: `Bearer ${token.access_token}` },
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
