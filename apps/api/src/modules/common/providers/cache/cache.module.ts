import { Global, Module } from '@nestjs/common';
import { CacheFactoryService } from '@providers/cache/services/cache-factory.service.js';
import { CacheInvalidationService } from '@providers/cache/services/cache-invalidation.service.js';

@Global()
@Module({
  providers: [CacheInvalidationService, CacheFactoryService],
  exports: [CacheFactoryService],
})
export class CacheModule {}
