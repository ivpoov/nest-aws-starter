import { FILE_REPOSITORY } from '@modules/file/constants/file.constants.js';
import { FileController } from '@modules/file/controllers/file.controller.js';
import { FilePrismaRepository } from '@modules/file/repositories/file-prisma.repository.js';
import { FileService } from '@modules/file/services/file.service.js';
import { Module } from '@nestjs/common';

@Module({
  controllers: [FileController],
  providers: [FileService, { provide: FILE_REPOSITORY, useClass: FilePrismaRepository }],
  exports: [FileService],
})
export class FileModule {}
