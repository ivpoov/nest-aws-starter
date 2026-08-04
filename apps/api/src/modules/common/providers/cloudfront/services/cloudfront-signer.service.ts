import { getSignedUrl } from '@aws-sdk/cloudfront-signer';
import { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
import type { CloudFrontSignerInterface } from '@providers/cloudfront/interfaces/cloudfront-signer.interface.js';
import type { EnabledCloudFrontConfigType } from '@providers/cloudfront/types/enabled-cloudfront-config.type.js';

// getSignedUrl() from @aws-sdk/cloudfront-signer is a local RSA-SHA1 signature
// computation — no network call — so this stays synchronous under the hood
// despite the async contract every provider method shares.
export class CloudFrontSignerService implements CloudFrontSignerInterface {
  private readonly logger = new CustomLoggerService(CloudFrontSignerService.name);

  constructor(private readonly config: EnabledCloudFrontConfigType) {}

  public async getSignedUrl(key: string): Promise<string> {
    const expiresAt: Date = new Date(Date.now() + this.config.urlTtlSec * 1000);
    const url: string = getSignedUrl({
      url: `https://${this.config.domain}/${key}`,
      keyPairId: this.config.keyPairId,
      privateKey: this.config.privateKey,
      dateLessThan: expiresAt,
    });

    this.logger.debug(`Signed CloudFront url for: ${key}`);

    return url;
  }
}
