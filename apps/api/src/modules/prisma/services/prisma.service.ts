import type { DatabaseConfig } from '@configs/database.config.js';
import { PrismaClient } from '@generated/prisma/client.js';
import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(configService: ConfigService) {
    const databaseUrl: string = configService.getOrThrow<DatabaseConfig>('database').url;

    super({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  }

  public async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  public async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
