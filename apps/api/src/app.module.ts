import { configs } from '@configs/index.js';
import { PrismaModule } from '@modules/prisma/prisma.module.js';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, load: configs }), PrismaModule],
})
export class AppModule {}
