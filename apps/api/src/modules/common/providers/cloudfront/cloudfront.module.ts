import { type CloudFrontConfig, cloudfrontConfig } from '@configs/cloudfront.config.js';
import { Global, Module } from '@nestjs/common';
import { CLOUDFRONT_SIGNER } from '@providers/cloudfront/constants/cloudfront.constants.js';
import type { CloudFrontSignerInterface } from '@providers/cloudfront/interfaces/cloudfront-signer.interface.js';
import { CloudFrontSignerService } from '@providers/cloudfront/services/cloudfront-signer.service.js';
import { DisabledCloudFrontSignerService } from '@providers/cloudfront/services/disabled-cloudfront-signer.service.js';

@Global()
@Module({
  providers: [
    {
      provide: CLOUDFRONT_SIGNER,
      inject: [cloudfrontConfig.KEY],
      useFactory: (config: CloudFrontConfig): CloudFrontSignerInterface =>
        config.isEnabled
          ? new CloudFrontSignerService(config)
          : new DisabledCloudFrontSignerService(),
    },
  ],
  exports: [CLOUDFRONT_SIGNER],
})
export class CloudFrontModule {}
