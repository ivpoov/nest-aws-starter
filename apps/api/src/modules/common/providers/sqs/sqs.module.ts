import { type SqsConfig, sqsConfig } from '@configs/sqs.config.js';
import { Global, Module } from '@nestjs/common';
import { SQS_PROVIDER } from '@providers/sqs/constants/sqs.constants.js';
import type { SqsProviderInterface } from '@providers/sqs/interfaces/sqs-provider.interface.js';
import { DisabledSqsProviderService } from '@providers/sqs/services/disabled-sqs-provider.service.js';
import { SqsProviderService } from '@providers/sqs/services/sqs-provider.service.js';

@Global()
@Module({
  providers: [
    {
      provide: SQS_PROVIDER,
      inject: [sqsConfig.KEY],
      useFactory: (config: SqsConfig): SqsProviderInterface =>
        config.isEnabled ? new SqsProviderService(config) : new DisabledSqsProviderService(),
    },
  ],
  exports: [SQS_PROVIDER],
})
export class SqsModule {}
