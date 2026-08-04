import { CaslModule } from '@modules/casl/casl.module.js';
import { STATISTIC_REPOSITORY } from '@modules/statistic/constants/statistic.constants.js';
import { StatisticAdminController } from '@modules/statistic/controllers/statistic-admin.controller.js';
import { statisticPermissions } from '@modules/statistic/permissions/statistic.permissions.js';
import { StatisticTypedSqlRepository } from '@modules/statistic/repositories/statistic-typed-sql.repository.js';
import { StatisticService } from '@modules/statistic/services/statistic.service.js';
import { StatisticCacheService } from '@modules/statistic/services/statistic-cache.service.js';
import { Module } from '@nestjs/common';

@Module({
  imports: [CaslModule.forFeature({ permissions: statisticPermissions })],
  controllers: [StatisticAdminController],
  providers: [
    StatisticService,
    StatisticCacheService,
    { provide: STATISTIC_REPOSITORY, useClass: StatisticTypedSqlRepository },
  ],
  exports: [StatisticService],
})
export class StatisticModule {}
