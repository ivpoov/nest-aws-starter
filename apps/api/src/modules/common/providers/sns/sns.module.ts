import { type SnsConfig, snsConfig } from '@configs/sns.config.js';
import { Global, Module } from '@nestjs/common';
import { SNS_PROVIDER } from '@providers/sns/constants/sns.constants.js';
import type { SnsProviderInterface } from '@providers/sns/interfaces/sns-provider.interface.js';
import { DisabledSnsProviderService } from '@providers/sns/services/disabled-sns-provider.service.js';
import { SnsProviderService } from '@providers/sns/services/sns-provider.service.js';

@Global()
@Module({
  providers: [
    {
      provide: SNS_PROVIDER,
      inject: [snsConfig.KEY],
      useFactory: (config: SnsConfig): SnsProviderInterface =>
        config.isEnabled ? new SnsProviderService(config) : new DisabledSnsProviderService(),
    },
  ],
  exports: [SNS_PROVIDER],
})
export class SnsModule {}
