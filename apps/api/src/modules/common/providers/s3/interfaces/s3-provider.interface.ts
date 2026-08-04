import type { HeadObjectResultInterface } from '@providers/s3/interfaces/head-object-result.interface.js';
import type { UploadFileDataInterface } from '@providers/s3/interfaces/upload-file-data.interface.js';

export interface S3ProviderInterface {
  upload(data: UploadFileDataInterface): Promise<string>;
  getPresignedUrl(key: string, expiresInSeconds: number): Promise<string>;
  getPresignedUploadUrl(
    key: string,
    contentType: string,
    expiresInSeconds: number,
  ): Promise<string>;
  delete(key: string): Promise<void>;
  headObject(key: string): Promise<HeadObjectResultInterface | null>;
}
