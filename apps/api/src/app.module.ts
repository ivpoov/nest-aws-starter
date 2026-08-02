import { configs } from '@configs/index.js';
import { HealthModule } from '@modules/health/health.module.js';
import { PrismaModule } from '@modules/prisma/prisma.module.js';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from '@providers/redis/redis.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: configs }),
    PrismaModule,
    RedisModule,
    HealthModule,
  ],
})
export class AppModule {}
