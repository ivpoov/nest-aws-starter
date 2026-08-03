import { OAUTH_STORE_REPOSITORY } from '@modules/oauth/constants/oauth.constants.js';
import { OauthController } from '@modules/oauth/controllers/oauth.controller.js';
import { OauthStoreRedisRepository } from '@modules/oauth/repositories/oauth-store-redis.repository.js';
import { OauthFlowService } from '@modules/oauth/services/oauth-flow.service.js';
import { OauthProviderRegistryService } from '@modules/oauth/services/oauth-provider-registry.service.js';
import { SessionModule } from '@modules/session/session.module.js';
import { UserModule } from '@modules/user/user.module.js';
import { Global, Module } from '@nestjs/common';

// Global so provider modules (google/facebook/discord) — and any other
// module, e.g. admin login-as injecting OauthFlowService — can use its
// exports with a single import line in AppModule. No forwardRef needed
// anywhere: @Global() makes exports injectable repo-wide regardless of
// which modules list OauthModule in their own `imports`.
@Global()
@Module({
  imports: [UserModule, SessionModule],
  controllers: [OauthController],
  providers: [
    OauthProviderRegistryService,
    OauthFlowService,
    { provide: OAUTH_STORE_REPOSITORY, useClass: OauthStoreRedisRepository },
  ],
  exports: [OauthProviderRegistryService, OauthFlowService],
})
export class OauthModule {}
