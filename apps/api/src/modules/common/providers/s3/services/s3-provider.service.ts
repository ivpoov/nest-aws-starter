import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  type HeadObjectCommandOutput,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
import type { HeadObjectResultInterface } from '@providers/s3/interfaces/head-object-result.interface.js';
import type { S3ProviderInterface } from '@providers/s3/interfaces/s3-provider.interface.js';
import type { UploadFileDataInterface } from '@providers/s3/interfaces/upload-file-data.interface.js';
import type { EnabledS3ConfigType } from '@providers/s3/types/enabled-s3-config.type.js';

export class S3ProviderService implements S3ProviderInterface {
  private readonly logger = new CustomLoggerService(S3ProviderService.name);
  private readonly client: S3Client;

  constructor(private readonly config: EnabledS3ConfigType) {
    this.client = new S3Client({
      region: config.region,
      // Omitted when no static keys are configured, so the SDK falls back to its
      // default credential provider chain and a deployed task signs with its own
      // IAM role — no long-lived key pair to store or rotate.
      ...(config.credentials && { credentials: config.credentials }),
      // MinIO (and most non-AWS endpoints) require path-style addressing.
      ...(config.endpoint && { endpoint: config.endpoint, forcePathStyle: true }),
    });
  }

  public async upload(data: UploadFileDataInterface): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucketName,
        Key: data.key,
        Body: data.body,
        ContentType: data.contentType,
      }),
    );

    this.logger.log(`Uploaded object: ${data.key}`);

    return data.key;
  }

  public async getPresignedUrl(key: string, expiresInSeconds: number): Promise<string> {
    const command: GetObjectCommand = new GetObjectCommand({
      Bucket: this.config.bucketName,
      Key: key,
    });

    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  public async getPresignedUploadUrl(
    key: string,
    contentType: string,
    expiresInSeconds: number,
  ): Promise<string> {
    const command: PutObjectCommand = new PutObjectCommand({
      Bucket: this.config.bucketName,
      Key: key,
      ContentType: contentType,
    });

    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  public async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.config.bucketName, Key: key }));

    this.logger.log(`Deleted object: ${key}`);
  }

  public async headObject(key: string): Promise<HeadObjectResultInterface | null> {
    try {
      const output: HeadObjectCommandOutput = await this.client.send(
        new HeadObjectCommand({ Bucket: this.config.bucketName, Key: key }),
      );

      return {
        contentLength: output.ContentLength ?? 0,
        contentType: output.ContentType ?? 'application/octet-stream',
      };
    } catch (caught) {
      if (this.isNotFound(caught)) return null;

      throw caught;
    }
  }

  private isNotFound(caught: unknown): boolean {
    return caught instanceof Error && caught.name === 'NotFound';
  }
}
