import type { CloudFrontConfig } from '@configs/cloudfront.config.js'; // <module:cloudfront>
import { ConflictError } from '@modules/common/errors/conflict.error.js';
import { ForbiddenError } from '@modules/common/errors/forbidden.error.js';
import { NotFoundError } from '@modules/common/errors/not-found.error.js';
import type { EventBusService } from '@modules/event/services/event-bus.service.js';
import type { FileInterface } from '@modules/file/interfaces/file.interface.js';
import type { FileRepositoryInterface } from '@modules/file/interfaces/file-repository.interface.js';
import { FileService } from '@modules/file/services/file.service.js';
import { FileIntentEnum, FileStatusEnum } from '@nest-aws-starter/shared';
import type { CloudFrontSignerInterface } from '@providers/cloudfront/interfaces/cloudfront-signer.interface.js'; // <module:cloudfront>
import type { HeadObjectResultInterface } from '@providers/s3/interfaces/head-object-result.interface.js';
import type { S3ProviderInterface } from '@providers/s3/interfaces/s3-provider.interface.js';
import { describe, expect, it, vi } from 'vitest';

const ownerId = '01890a5d-0000-774b-bcce-b30209990001';
const strangerId = '01890a5d-0000-774b-bcce-b30209990002';

const pendingFile: FileInterface = {
  id: '01890a5d-ac96-774b-bcce-b302099a8057',
  ownerId,
  intent: FileIntentEnum.ATTACHMENT,
  key: 'files/owner/object-1',
  contentType: 'application/pdf',
  size: 0,
  status: FileStatusEnum.PENDING,
  createdAt: new Date('2026-08-02T12:00:00Z'),
  updatedAt: new Date('2026-08-02T12:00:00Z'),
};

const readyFile: FileInterface = { ...pendingFile, status: FileStatusEnum.READY, size: 1024 };

interface TestSetupInterface {
  readonly service: FileService;
  readonly fileRepository: FileRepositoryInterface;
  readonly s3Provider: S3ProviderInterface;
  readonly cloudFrontSigner: CloudFrontSignerInterface; // <module:cloudfront>
  readonly emit: ReturnType<typeof vi.fn>;
}

function createService(
  overrides: Partial<FileRepositoryInterface> = {},
  s3Overrides: Partial<S3ProviderInterface> = {},
  cloudFrontConfig: CloudFrontConfig = { isEnabled: false }, // <module:cloudfront>
): TestSetupInterface {
  const fileRepository: FileRepositoryInterface = {
    create: vi.fn().mockResolvedValue(pendingFile),
    findById: vi.fn().mockResolvedValue(pendingFile),
    markReady: vi.fn().mockResolvedValue(readyFile),
    findStalePending: vi.fn().mockResolvedValue([]),
    deleteById: vi.fn(),
    ...overrides,
  };
  const s3Provider: S3ProviderInterface = {
    upload: vi.fn(),
    getPresignedUrl: vi.fn().mockResolvedValue('https://s3.example/download'),
    getPresignedUploadUrl: vi.fn().mockResolvedValue('https://s3.example/upload'),
    delete: vi.fn(),
    headObject: vi.fn().mockResolvedValue({ contentLength: 1024, contentType: 'application/pdf' }),
    ...s3Overrides,
  };
  // <module:cloudfront>
  const cloudFrontSigner: CloudFrontSignerInterface = {
    getSignedUrl: vi.fn().mockResolvedValue('https://cdn.example.com/signed'),
  };
  // </module:cloudfront>
  const emit = vi.fn();
  const eventBus = { emit } as unknown as EventBusService;
  const service: FileService = new FileService(
    fileRepository,
    s3Provider,
    // <module:cloudfront>
    cloudFrontSigner,
    cloudFrontConfig,
    // </module:cloudfront>
    eventBus,
  );

  return {
    service,
    fileRepository,
    s3Provider,
    cloudFrontSigner, // <module:cloudfront>
    emit,
  };
}

describe('FileService.requestUpload', () => {
  it('issues a presigned upload url and creates a pending row', async () => {
    const { service, fileRepository, s3Provider } = createService();

    const result = await service.requestUpload(
      ownerId,
      FileIntentEnum.ATTACHMENT,
      'application/pdf',
      2048,
    );

    expect(result.fileId).toBe(pendingFile.id);
    expect(result.uploadUrl).toBe('https://s3.example/upload');
    expect(result.key).toMatch(new RegExp(`^files/${ownerId}/`));
    expect(s3Provider.getPresignedUploadUrl).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`^files/${ownerId}/`)),
      'application/pdf',
      300,
    );
    expect(fileRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId, intent: FileIntentEnum.ATTACHMENT, size: 2048 }),
    );
  });

  it('rejects a content type outside the intent allowlist', async () => {
    const { service } = createService();

    await expect(
      service.requestUpload(ownerId, FileIntentEnum.AVATAR, 'application/pdf'),
    ).rejects.toMatchObject({ args: { code: 'FILE_CONTENT_TYPE_NOT_ALLOWED' } });
  });

  it('rejects a declared size over the intent cap', async () => {
    const { service } = createService();

    await expect(
      service.requestUpload(ownerId, FileIntentEnum.AVATAR, 'image/png', 10 * 1024 * 1024),
    ).rejects.toMatchObject({ args: { code: 'FILE_TOO_LARGE' } });
  });
});

describe('FileService.confirmUpload', () => {
  it('marks the file ready from the head result and emits file.uploaded', async () => {
    const { service, fileRepository, emit } = createService();

    const result = await service.confirmUpload(ownerId, pendingFile.id);

    expect(result).toEqual(readyFile);
    expect(fileRepository.markReady).toHaveBeenCalledWith(pendingFile.id, {
      contentType: 'application/pdf',
      size: 1024,
    });
    expect(emit).toHaveBeenCalledWith('file.uploaded', {
      fileId: readyFile.id,
      userId: ownerId,
      intent: readyFile.intent,
    });
  });

  it('throws FILE_NOT_UPLOADED (conflict) when no object exists at the key', async () => {
    const { service } = createService({}, { headObject: vi.fn().mockResolvedValue(null) });

    const caught: unknown = await service
      .confirmUpload(ownerId, pendingFile.id)
      .then(() => null)
      .catch((error: unknown): unknown => error);

    expect(caught).toBeInstanceOf(ConflictError);
    expect((caught as ConflictError).args.code).toBe('FILE_NOT_UPLOADED');
  });

  it('throws FILE_CONTENT_TYPE_NOT_ALLOWED when the object S3 observed is not the declared type', async () => {
    // Regression for the spoofed-content-type bypass: s3-request-presigner
    // puts Content-Type in unsignableHeaders, so a client can declare an
    // allowed type at requestUpload and PUT a different, disallowed one.
    // confirmUpload must re-validate what S3 actually stored, not trust the
    // type declared earlier.
    const spoofedHead: HeadObjectResultInterface = {
      contentLength: 1024,
      contentType: 'application/x-msdownload',
    };
    const { service, fileRepository } = createService(
      {},
      { headObject: vi.fn().mockResolvedValue(spoofedHead) },
    );

    await expect(service.confirmUpload(ownerId, pendingFile.id)).rejects.toMatchObject({
      args: { code: 'FILE_CONTENT_TYPE_NOT_ALLOWED' },
    });
    expect(fileRepository.markReady).not.toHaveBeenCalled();
  });

  it('throws FILE_TOO_LARGE when the uploaded object exceeds the intent cap', async () => {
    const oversizedHead: HeadObjectResultInterface = {
      contentLength: 20 * 1024 * 1024,
      contentType: 'application/pdf',
    };
    const { service } = createService({}, { headObject: vi.fn().mockResolvedValue(oversizedHead) });

    await expect(service.confirmUpload(ownerId, pendingFile.id)).rejects.toMatchObject({
      args: { code: 'FILE_TOO_LARGE' },
    });
  });

  it('denies confirming a foreign file', async () => {
    const { service } = createService();

    await expect(service.confirmUpload(strangerId, pendingFile.id)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it('throws the coded not-found error for a missing file', async () => {
    const { service } = createService({ findById: vi.fn().mockResolvedValue(null) });

    await expect(service.confirmUpload(ownerId, 'missing-id')).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe('FileService.getDownloadUrl', () => {
  it('returns a presigned s3 url when cloudfront is disabled', async () => {
    const {
      service,
      s3Provider,
      cloudFrontSigner, // <module:cloudfront>
    } = createService({
      findById: vi.fn().mockResolvedValue(readyFile),
    });

    const result = await service.getDownloadUrl(ownerId, readyFile.id);

    expect(result).toEqual({ downloadUrl: 'https://s3.example/download' });
    expect(s3Provider.getPresignedUrl).toHaveBeenCalledWith(readyFile.key, 300);
    expect(cloudFrontSigner.getSignedUrl).not.toHaveBeenCalled(); // <module:cloudfront>
  });

  // <module:cloudfront>
  it('returns a cloudfront signed url when cloudfront is enabled', async () => {
    const { service, s3Provider, cloudFrontSigner } = createService(
      { findById: vi.fn().mockResolvedValue(readyFile) },
      {},
      {
        isEnabled: true,
        domain: 'cdn.example.com',
        keyPairId: 'K1',
        privateKey: 'pem',
        urlTtlSec: 300,
      },
    );

    const result = await service.getDownloadUrl(ownerId, readyFile.id);

    expect(result).toEqual({ downloadUrl: 'https://cdn.example.com/signed' });
    expect(cloudFrontSigner.getSignedUrl).toHaveBeenCalledWith(readyFile.key);
    expect(s3Provider.getPresignedUrl).not.toHaveBeenCalled();
  });
  // </module:cloudfront>

  it('rejects a download before the file is ready (conflict)', async () => {
    const { service } = createService({ findById: vi.fn().mockResolvedValue(pendingFile) });

    const caught: unknown = await service
      .getDownloadUrl(ownerId, pendingFile.id)
      .then(() => null)
      .catch((error: unknown): unknown => error);

    expect(caught).toBeInstanceOf(ConflictError);
    expect((caught as ConflictError).args.code).toBe('FILE_NOT_READY');
  });

  it('denies downloading a foreign file', async () => {
    const { service } = createService({ findById: vi.fn().mockResolvedValue(readyFile) });

    await expect(service.getDownloadUrl(strangerId, readyFile.id)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});

describe('FileService.sweepOrphans', () => {
  it('queries stale PENDING rows via the repository and reports zero counts when none are found', async () => {
    const { service, fileRepository } = createService({
      findStalePending: vi.fn().mockResolvedValue([]),
    });

    const result = await service.sweepOrphans();

    expect(result).toEqual({
      markedReadyCount: 0,
      deletedAbsentCount: 0,
      deletedInvalidCount: 0,
      failedCount: 0,
    });
    expect(fileRepository.findStalePending).toHaveBeenCalledWith(expect.any(Date), 200);
  });

  it('marks a row READY and emits file.uploaded when the object exists and passes the allowlist', async () => {
    const { service, fileRepository, s3Provider, emit } = createService(
      { findStalePending: vi.fn().mockResolvedValue([pendingFile]) },
      {
        headObject: vi
          .fn()
          .mockResolvedValue({ contentLength: 1024, contentType: 'application/pdf' }),
      },
    );

    const result = await service.sweepOrphans();

    expect(result).toEqual({
      markedReadyCount: 1,
      deletedAbsentCount: 0,
      deletedInvalidCount: 0,
      failedCount: 0,
    });
    expect(fileRepository.markReady).toHaveBeenCalledWith(pendingFile.id, {
      contentType: 'application/pdf',
      size: 1024,
    });
    expect(fileRepository.deleteById).not.toHaveBeenCalled();
    expect(s3Provider.delete).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith('file.uploaded', {
      fileId: pendingFile.id,
      userId: pendingFile.ownerId,
      intent: pendingFile.intent,
    });
  });

  it('deletes the row when no object exists at the key', async () => {
    const { service, fileRepository, s3Provider } = createService(
      { findStalePending: vi.fn().mockResolvedValue([pendingFile]) },
      { headObject: vi.fn().mockResolvedValue(null) },
    );

    const result = await service.sweepOrphans();

    expect(result).toEqual({
      markedReadyCount: 0,
      deletedAbsentCount: 1,
      deletedInvalidCount: 0,
      failedCount: 0,
    });
    expect(fileRepository.deleteById).toHaveBeenCalledWith(pendingFile.id);
    expect(s3Provider.delete).not.toHaveBeenCalled();
    expect(fileRepository.markReady).not.toHaveBeenCalled();
  });

  // Object present but failing the same allowlist confirmUpload would apply
  // must be deleted, never reconciled to READY — see file.service.ts's
  // isUploadedObjectValid doc comment.
  it('deletes both the S3 object and the row when the object fails the content-type allowlist', async () => {
    const { service, fileRepository, s3Provider } = createService(
      { findStalePending: vi.fn().mockResolvedValue([pendingFile]) },
      {
        headObject: vi
          .fn()
          .mockResolvedValue({ contentLength: 1024, contentType: 'application/x-msdownload' }),
      },
    );

    const result = await service.sweepOrphans();

    expect(result).toEqual({
      markedReadyCount: 0,
      deletedAbsentCount: 0,
      deletedInvalidCount: 1,
      failedCount: 0,
    });
    expect(s3Provider.delete).toHaveBeenCalledWith(pendingFile.key);
    expect(fileRepository.deleteById).toHaveBeenCalledWith(pendingFile.id);
    expect(fileRepository.markReady).not.toHaveBeenCalled();
  });

  it('deletes both the S3 object and the row when the object exceeds the intent size cap', async () => {
    const { service, fileRepository, s3Provider } = createService(
      { findStalePending: vi.fn().mockResolvedValue([pendingFile]) },
      {
        headObject: vi
          .fn()
          .mockResolvedValue({ contentLength: 20 * 1024 * 1024, contentType: 'application/pdf' }),
      },
    );

    const result = await service.sweepOrphans();

    expect(result).toEqual({
      markedReadyCount: 0,
      deletedAbsentCount: 0,
      deletedInvalidCount: 1,
      failedCount: 0,
    });
    expect(s3Provider.delete).toHaveBeenCalledWith(pendingFile.key);
    expect(fileRepository.deleteById).toHaveBeenCalledWith(pendingFile.id);
  });

  it('passes the batch limit constant through to the repository query', async () => {
    const { service, fileRepository } = createService();

    await service.sweepOrphans();

    const [, limitArg] = (fileRepository.findStalePending as ReturnType<typeof vi.fn>).mock
      .calls[0] as [Date, number];

    expect(limitArg).toBe(200);
  });

  it('tallies mixed outcomes across a multi-row batch', async () => {
    const absentFile: FileInterface = { ...pendingFile, id: 'file-absent', key: 'files/absent' };
    const invalidFile: FileInterface = { ...pendingFile, id: 'file-invalid', key: 'files/invalid' };
    const headObject = vi.fn().mockImplementation((key: string) => {
      if (key === absentFile.key) return Promise.resolve(null);
      if (key === invalidFile.key) {
        return Promise.resolve({ contentLength: 1, contentType: 'application/x-msdownload' });
      }

      return Promise.resolve({ contentLength: 1024, contentType: 'application/pdf' });
    });
    const { service } = createService(
      { findStalePending: vi.fn().mockResolvedValue([pendingFile, absentFile, invalidFile]) },
      { headObject },
    );

    const result = await service.sweepOrphans();

    expect(result).toEqual({
      markedReadyCount: 1,
      deletedAbsentCount: 1,
      deletedInvalidCount: 1,
      failedCount: 0,
    });
  });

  // Regression: a transient S3 error (throttle/timeout) on one row must not
  // abort the batch — the failing row is skipped (left PENDING for the next
  // run) and every remaining row still gets swept, same containment shape
  // as WebhookRetryService.enqueue on the payment side.
  it('continues sweeping remaining rows when headObject rejects for an earlier row', async () => {
    const failingFile: FileInterface = { ...pendingFile, id: 'file-failing', key: 'files/failing' };
    const okFile: FileInterface = { ...pendingFile, id: 'file-ok', key: 'files/ok' };
    const headObject = vi.fn().mockImplementation((key: string) => {
      if (key === failingFile.key) return Promise.reject(new Error('S3 throttled'));

      return Promise.resolve({ contentLength: 1024, contentType: 'application/pdf' });
    });
    const { service, fileRepository } = createService(
      { findStalePending: vi.fn().mockResolvedValue([failingFile, okFile]) },
      { headObject },
    );

    const result = await service.sweepOrphans();

    expect(result).toEqual({
      markedReadyCount: 1,
      deletedAbsentCount: 0,
      deletedInvalidCount: 0,
      failedCount: 1,
    });
    expect(headObject).toHaveBeenCalledWith(failingFile.key);
    expect(headObject).toHaveBeenCalledWith(okFile.key);
    expect(fileRepository.markReady).toHaveBeenCalledWith(okFile.id, expect.anything());
    expect(fileRepository.deleteById).not.toHaveBeenCalledWith(failingFile.id);
  });
});
