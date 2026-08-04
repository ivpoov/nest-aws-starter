import { InternalError } from '@modules/common/errors/internal.error.js';
import { CLOUDFRONT_SIGNER_DISABLED } from '@providers/cloudfront/constants/cloudfront-errors.constants.js';
import type { CloudFrontSignerInterface } from '@providers/cloudfront/interfaces/cloudfront-signer.interface.js';

// Bound when CLOUDFRONT_ENABLED=false: consumers keep compiling, misuse fails
// loudly with a coded error naming the flag.
export class DisabledCloudFrontSignerService implements CloudFrontSignerInterface {
  public getSignedUrl(_key: string): Promise<string> {
    return this.throwDisabled();
  }

  private throwDisabled(): never {
    throw new InternalError(CLOUDFRONT_SIGNER_DISABLED);
  }
}
