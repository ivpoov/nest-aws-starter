import { configs } from '@configs/index.js';
import { HealthModule } from '@modules/health/health.module.js';
import { PrismaModule } from '@modules/prisma/prisma.module.js';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, load: configs }), PrismaModule, HealthModule],
})
export class AppModule {}
