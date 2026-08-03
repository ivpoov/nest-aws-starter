import { type DiscordOauthConfig, discordOauthConfig } from '@configs/discord-oauth.config.js';
import { OauthProviderRegistryService } from '@modules/oauth/services/oauth-provider-registry.service.js';
import { DiscordOauthProvider } from '@modules/oauth-discord/providers/discord-oauth.provider.js';
import { Module, type Provider } from '@nestjs/common';
import { HttpClientService } from '@providers/http-client/services/http-client.service.js';

const registrationProvider: Provider = {
  provide: Symbol('DISCORD_OAUTH_REGISTRATION'),
  inject: [discordOauthConfig.KEY, OauthProviderRegistryService, HttpClientService],
  useFactory: (
    config: DiscordOauthConfig,
    registry: OauthProviderRegistryService,
    httpClient: HttpClientService,
  ): boolean => {
    if (config.isEnabled) registry.register(new DiscordOauthProvider(config, httpClient));

    return config.isEnabled;
  },
};

@Module({
  providers: [registrationProvider],
})
export class DiscordOauthModule {}
