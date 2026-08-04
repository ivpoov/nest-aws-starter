import { InternalError } from '@modules/common/errors/internal.error.js';
import { S3_PROVIDER_DISABLED } from '@providers/s3/constants/s3-errors.constants.js';
import type { HeadObjectResultInterface } from '@providers/s3/interfaces/head-object-result.interface.js';
import type { S3ProviderInterface } from '@providers/s3/interfaces/s3-provider.interface.js';
import type { UploadFileDataInterface } from '@providers/s3/interfaces/upload-file-data.interface.js';

// Bound when S3_ENABLED=false: consumers keep compiling, misuse fails loudly
// with a coded error naming the flag.
export class DisabledS3ProviderService implements S3ProviderInterface {
  public upload(_data: UploadFileDataInterface): Promise<string> {
    return this.throwDisabled();
  }

  public getPresignedUrl(_key: string, _expiresInSeconds: number): Promise<string> {
    return this.throwDisabled();
  }

  public getPresignedUploadUrl(
    _key: string,
    _contentType: string,
    _expiresInSeconds: number,
  ): Promise<string> {
    return this.throwDisabled();
  }

  public delete(_key: string): Promise<void> {
    return this.throwDisabled();
  }

  public headObject(_key: string): Promise<HeadObjectResultInterface | null> {
    return this.throwDisabled();
  }

  private throwDisabled(): never {
    throw new InternalError(S3_PROVIDER_DISABLED);
  }
}
