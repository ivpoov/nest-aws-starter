import { type FacebookOauthConfig, facebookOauthConfig } from '@configs/facebook-oauth.config.js';
import { OauthProviderRegistryService } from '@modules/oauth/services/oauth-provider-registry.service.js';
import { FacebookOauthProvider } from '@modules/oauth-facebook/providers/facebook-oauth.provider.js';
import { Module, type Provider } from '@nestjs/common';
import { HttpClientService } from '@providers/http-client/services/http-client.service.js';

const registrationProvider: Provider = {
  provide: Symbol('FACEBOOK_OAUTH_REGISTRATION'),
  inject: [facebookOauthConfig.KEY, OauthProviderRegistryService, HttpClientService],
  useFactory: (
    config: FacebookOauthConfig,
    registry: OauthProviderRegistryService,
    httpClient: HttpClientService,
  ): boolean => {
    if (config.isEnabled) registry.register(new FacebookOauthProvider(config, httpClient));

    return config.isEnabled;
  },
};

@Module({
  providers: [registrationProvider],
})
export class FacebookOauthModule {}
