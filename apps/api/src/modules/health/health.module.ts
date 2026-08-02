import { HealthController } from '@modules/health/controllers/health.controller.js';
import { HealthService } from '@modules/health/services/health.service.js';
import { Module } from '@nestjs/common';

@Module({
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
