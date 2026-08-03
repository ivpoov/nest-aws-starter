import { OAUTH_STORE_REPOSITORY } from '@modules/oauth/constants/oauth.constants.js';
import { OauthController } from '@modules/oauth/controllers/oauth.controller.js';
import { OauthStoreRedisRepository } from '@modules/oauth/repositories/oauth-store-redis.repository.js';
import { OauthFlowService } from '@modules/oauth/services/oauth-flow.service.js';
import { OauthProviderRegistryService } from '@modules/oauth/services/oauth-provider-registry.service.js';
import { SessionModule } from '@modules/session/session.module.js';
import { UserModule } from '@modules/user/user.module.js';
import { forwardRef, Global, Module } from '@nestjs/common';

// Global so provider modules (google/facebook/discord) can inject the registry
// with a single import line in AppModule. UserModule now imports OauthModule
// back (admin login-as mints an exchange code via OauthFlowService) — same
// mutual-forwardRef shape already used for User<->Session.
@Global()
@Module({
  imports: [forwardRef(() => UserModule), SessionModule],
  controllers: [OauthController],
  providers: [
    OauthProviderRegistryService,
    OauthFlowService,
    { provide: OAUTH_STORE_REPOSITORY, useClass: OauthStoreRedisRepository },
  ],
  exports: [OauthProviderRegistryService, OauthFlowService],
})
export class OauthModule {}
