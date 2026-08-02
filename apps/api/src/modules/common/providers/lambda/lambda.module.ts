import { type LambdaConfig, lambdaConfig } from '@configs/lambda.config.js';
import { Global, Module } from '@nestjs/common';
import { LAMBDA_PROVIDER } from '@providers/lambda/constants/lambda.constants.js';
import type { LambdaProviderInterface } from '@providers/lambda/interfaces/lambda-provider.interface.js';
import { DisabledLambdaProviderService } from '@providers/lambda/services/disabled-lambda-provider.service.js';
import { LambdaProviderService } from '@providers/lambda/services/lambda-provider.service.js';

@Global()
@Module({
  providers: [
    {
      provide: LAMBDA_PROVIDER,
      inject: [lambdaConfig.KEY],
      useFactory: (config: LambdaConfig): LambdaProviderInterface =>
        config.isEnabled ? new LambdaProviderService(config) : new DisabledLambdaProviderService(),
    },
  ],
  exports: [LAMBDA_PROVIDER],
})
export class LambdaModule {}
