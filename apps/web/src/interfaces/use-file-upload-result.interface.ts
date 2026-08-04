import type { ApiErrorInterface } from '@nest-aws-starter/shared';
import type { FileUploadStatusType } from '../types/file-upload-status.type';
import type { UploadedFileInterface } from './uploaded-file.interface';

export interface UseFileUploadResultInterface {
  readonly status: FileUploadStatusType;
  readonly error: ApiErrorInterface | null;
  readonly uploads: UploadedFileInterface[];
  readonly upload: (file: File) => Promise<void>;
  readonly download: (fileId: string) => Promise<void>;
}
