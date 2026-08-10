import { UNIT_OF_WORK } from '@constants/unit-of-work.constants.js';
import { PrismaService } from '@modules/prisma/services/prisma.service.js';
import { PrismaUnitOfWorkService } from '@modules/prisma/services/prisma-unit-of-work.service.js';
import { Global, Module } from '@nestjs/common';

@Global()
@Module({
  providers: [PrismaService, { provide: UNIT_OF_WORK, useClass: PrismaUnitOfWorkService }],
  exports: [PrismaService, UNIT_OF_WORK],
})
export class PrismaModule {}
