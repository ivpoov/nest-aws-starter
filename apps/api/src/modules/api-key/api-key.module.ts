import { API_KEY_REPOSITORY } from '@modules/api-key/constants/api-key.constants.js';
import { ApiDemoController } from '@modules/api-key/controllers/api-demo.controller.js';
import { ApiKeyAdminController } from '@modules/api-key/controllers/api-key-admin.controller.js';
import { ApiKeyGuard } from '@modules/api-key/guards/api-key.guard.js';
import { ApiKeyThrottlerGuard } from '@modules/api-key/guards/api-key-throttler.guard.js';
import { apiKeyPermissions } from '@modules/api-key/permissions/api-key.permissions.js';
import { ApiKeyPrismaRepository } from '@modules/api-key/repositories/api-key-prisma.repository.js';
import { ApiKeyService } from '@modules/api-key/services/api-key.service.js';
import { CaslModule } from '@modules/casl/casl.module.js';
import { Module } from '@nestjs/common';

@Module({
  imports: [CaslModule.forFeature({ permissions: apiKeyPermissions })],
  controllers: [ApiKeyAdminController, ApiDemoController],
  providers: [
    ApiKeyService,
    ApiKeyGuard,
    ApiKeyThrottlerGuard,
    { provide: API_KEY_REPOSITORY, useClass: ApiKeyPrismaRepository },
  ],
  exports: [ApiKeyService],
})
export class ApiKeyModule {}
