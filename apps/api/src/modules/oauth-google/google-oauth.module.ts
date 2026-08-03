import { type GoogleOauthConfig, googleOauthConfig } from '@configs/google-oauth.config.js';
import { OauthProviderRegistryService } from '@modules/oauth/services/oauth-provider-registry.service.js';
import { GoogleOauthProvider } from '@modules/oauth-google/providers/google-oauth.provider.js';
import { Module, type Provider } from '@nestjs/common';
import { HttpClientService } from '@providers/http-client/services/http-client.service.js';

const registrationProvider: Provider = {
  provide: Symbol('GOOGLE_OAUTH_REGISTRATION'),
  inject: [googleOauthConfig.KEY, OauthProviderRegistryService, HttpClientService],
  useFactory: (
    config: GoogleOauthConfig,
    registry: OauthProviderRegistryService,
    httpClient: HttpClientService,
  ): boolean => {
    // Unconfigured providers never register — their buttons simply don't exist.
    if (config.isEnabled) registry.register(new GoogleOauthProvider(config, httpClient));

    return config.isEnabled;
  },
};

@Module({
  providers: [registrationProvider],
})
export class GoogleOauthModule {}
