import { FILE_REPOSITORY } from '@modules/file/constants/file.constants.js';
import { FileController } from '@modules/file/controllers/file.controller.js';
import { OrphanFileSweepJob } from '@modules/file/jobs/orphan-file-sweep.job.js';
import { FilePrismaRepository } from '@modules/file/repositories/file-prisma.repository.js';
import { FileService } from '@modules/file/services/file.service.js';
import { ScheduledJobRegistryService } from '@modules/task-scheduler/services/scheduled-job-registry.service.js';
import { Module, type Provider } from '@nestjs/common';

// Same self-registration idiom as payment.module.ts's
// scheduledJobRegistrationProvider (TaskSchedulerModule is @Global(), so
// ScheduledJobRegistryService is already resolvable here).
const scheduledJobRegistrationProvider: Provider = {
  provide: Symbol('ORPHAN_FILE_SWEEP_JOB_REGISTRATION'),
  inject: [ScheduledJobRegistryService, FileService],
  useFactory: (registry: ScheduledJobRegistryService, fileService: FileService): boolean => {
    registry.register(new OrphanFileSweepJob(fileService));

    return true;
  },
};

@Module({
  controllers: [FileController],
  providers: [
    FileService,
    { provide: FILE_REPOSITORY, useClass: FilePrismaRepository },
    scheduledJobRegistrationProvider,
  ],
  exports: [FileService],
})
export class FileModule {}
