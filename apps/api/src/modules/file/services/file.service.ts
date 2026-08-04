import { randomUUID } from 'node:crypto';
import { type CloudFrontConfig, cloudfrontConfig } from '@configs/cloudfront.config.js';
import { ForbiddenError } from '@modules/common/errors/forbidden.error.js';
import { NotFoundError } from '@modules/common/errors/not-found.error.js';
import { ValidationError } from '@modules/common/errors/validation.error.js';
import { FILE_UPLOADED_EVENT } from '@modules/event/constants/event-names.constants.js';
import { EventBusService } from '@modules/event/services/event-bus.service.js';
import { FILE_REPOSITORY } from '@modules/file/constants/file.constants.js';
import {
  FILE_ACCESS_DENIED,
  FILE_CONTENT_TYPE_NOT_ALLOWED,
  FILE_NOT_FOUND,
  FILE_NOT_READY,
  FILE_NOT_UPLOADED,
  FILE_TOO_LARGE,
} from '@modules/file/constants/file-errors.constants.js';
import {
  ALLOWED_FILE_CONTENT_TYPES,
  FILE_DOWNLOAD_TTL_SEC,
  FILE_MAX_SIZE_BYTES,
  FILE_UPLOAD_TTL_SEC,
} from '@modules/file/constants/file-upload.constants.js';
import type { FileInterface } from '@modules/file/interfaces/file.interface.js';
import type { FileRepositoryInterface } from '@modules/file/interfaces/file-repository.interface.js';
import { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
import {
  type DownloadUrlResponseInterface,
  FileIntentEnum,
  FileStatusEnum,
  type RequestUploadResponseInterface,
} from '@nest-aws-starter/shared';
import { Inject, Injectable } from '@nestjs/common';
import { CLOUDFRONT_SIGNER } from '@providers/cloudfront/constants/cloudfront.constants.js';
import type { CloudFrontSignerInterface } from '@providers/cloudfront/interfaces/cloudfront-signer.interface.js';
import { S3_PROVIDER } from '@providers/s3/constants/s3.constants.js';
import type { HeadObjectResultInterface } from '@providers/s3/interfaces/head-object-result.interface.js';
import type { S3ProviderInterface } from '@providers/s3/interfaces/s3-provider.interface.js';

@Injectable()
export class FileService {
  private readonly logger = new CustomLoggerService(FileService.name);

  constructor(
    @Inject(FILE_REPOSITORY)
    private readonly fileRepository: FileRepositoryInterface,
    @Inject(S3_PROVIDER)
    private readonly s3Provider: S3ProviderInterface,
    @Inject(CLOUDFRONT_SIGNER)
    private readonly cloudFrontSigner: CloudFrontSignerInterface,
    @Inject(cloudfrontConfig.KEY)
    private readonly cloudFrontConfig: CloudFrontConfig,
    private readonly eventBus: EventBusService,
  ) {}

  // The key is fixed server-side to the caller's own namespace — a client can
  // never point its upload at another user's object.
  public async requestUpload(
    userId: string,
    intent: FileIntentEnum,
    contentType: string,
    size?: number,
  ): Promise<RequestUploadResponseInterface> {
    this.assertContentTypeAllowed(intent, contentType);
    if (size !== undefined) this.assertSizeAllowed(intent, size);

    const key: string = `files/${userId}/${randomUUID()}`;
    const uploadUrl: string = await this.s3Provider.getPresignedUploadUrl(
      key,
      contentType,
      FILE_UPLOAD_TTL_SEC,
    );
    const file: FileInterface = await this.fileRepository.create({
      ownerId: userId,
      intent,
      key,
      contentType,
      size: size ?? 0,
    });

    this.logger.log(`File upload requested: ${file.id}`);

    return { fileId: file.id, uploadUrl, key };
  }

  public async confirmUpload(userId: string, fileId: string): Promise<FileInterface> {
    const file: FileInterface = await this.findOwnedOrThrow(fileId, userId);
    const head: HeadObjectResultInterface | null = await this.s3Provider.headObject(file.key);

    if (!head) throw new ValidationError(FILE_NOT_UPLOADED);
    if (head.contentLength > FILE_MAX_SIZE_BYTES[file.intent]) {
      throw new ValidationError(FILE_TOO_LARGE);
    }

    const updated: FileInterface | null = await this.fileRepository.markReady(fileId, {
      contentType: head.contentType,
      size: head.contentLength,
    });

    if (!updated) throw new NotFoundError(FILE_NOT_FOUND);

    this.logger.log(`File confirmed ready: ${updated.id}`);
    this.eventBus.emit(FILE_UPLOADED_EVENT, {
      fileId: updated.id,
      userId,
      intent: updated.intent,
    });

    return updated;
  }

  public async getDownloadUrl(
    userId: string,
    fileId: string,
  ): Promise<DownloadUrlResponseInterface> {
    const file: FileInterface = await this.findOwnedOrThrow(fileId, userId);

    if (file.status !== FileStatusEnum.READY) throw new ValidationError(FILE_NOT_READY);

    const downloadUrl: string = this.cloudFrontConfig.isEnabled
      ? await this.cloudFrontSigner.getSignedUrl(file.key)
      : await this.s3Provider.getPresignedUrl(file.key, FILE_DOWNLOAD_TTL_SEC);

    return { downloadUrl };
  }

  private assertContentTypeAllowed(intent: FileIntentEnum, contentType: string): void {
    if (!ALLOWED_FILE_CONTENT_TYPES[intent].includes(contentType)) {
      throw new ValidationError(FILE_CONTENT_TYPE_NOT_ALLOWED);
    }
  }

  private assertSizeAllowed(intent: FileIntentEnum, size: number): void {
    if (size > FILE_MAX_SIZE_BYTES[intent]) throw new ValidationError(FILE_TOO_LARGE);
  }

  // 404 for a missing file, 403 for someone else's — existence is not leaked
  // the other way around because file ids are not guessable (UUIDv7).
  private async findOwnedOrThrow(id: string, userId: string): Promise<FileInterface> {
    const file: FileInterface | null = await this.fileRepository.findById(id);

    if (!file) throw new NotFoundError(FILE_NOT_FOUND);
    if (file.ownerId !== userId) throw new ForbiddenError(FILE_ACCESS_DENIED);

    return file;
  }
}
