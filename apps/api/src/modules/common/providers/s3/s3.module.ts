import { type S3Config, s3Config } from '@configs/s3.config.js';
import { Global, Module } from '@nestjs/common';
import { S3_PROVIDER } from '@providers/s3/constants/s3.constants.js';
import type { S3ProviderInterface } from '@providers/s3/interfaces/s3-provider.interface.js';
import { DisabledS3ProviderService } from '@providers/s3/services/disabled-s3-provider.service.js';
import { S3ProviderService } from '@providers/s3/services/s3-provider.service.js';

@Global()
@Module({
  providers: [
    {
      provide: S3_PROVIDER,
      inject: [s3Config.KEY],
      useFactory: (config: S3Config): S3ProviderInterface =>
        config.isEnabled ? new S3ProviderService(config) : new DisabledS3ProviderService(),
    },
  ],
  exports: [S3_PROVIDER],
})
export class S3Module {}
