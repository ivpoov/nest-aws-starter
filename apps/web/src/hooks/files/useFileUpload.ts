import type {
  ApiErrorInterface,
  DownloadUrlResponseInterface,
  FileIntentEnum,
  FileResponseInterface,
  RequestUploadResponseInterface,
} from '@nest-aws-starter/shared';
import { useCallback, useState } from 'react';
import { confirmFileUpload, fetchFileDownloadUrl, requestFileUpload } from '../../apis/files';
import type { UploadedFileInterface } from '../../interfaces/uploaded-file.interface';
import type { UseFileUploadResultInterface } from '../../interfaces/use-file-upload-result.interface';
import type { FileUploadStatusType } from '../../types/file-upload-status.type';
import { apiClient } from '../../utils/apiClient';
import { buildClientError } from '../../utils/buildClientError';
import { toApiError } from '../../utils/toApiError';
import { validateFileUpload } from '../../utils/validateFileUpload';

async function putToPresignedUrl(url: string, file: File): Promise<void> {
  try {
    await apiClient.uploadToUrl(url, file, file.type);
  } catch {
    throw buildClientError('FILE_UPLOAD_LINK_EXPIRED', 'Upload link expired, try again');
  }
}

async function performUpload(
  file: File,
  intent: FileIntentEnum,
  setStatus: (status: FileUploadStatusType) => void,
): Promise<UploadedFileInterface> {
  setStatus('requesting');
  const requested: RequestUploadResponseInterface = await requestFileUpload({
    intent,
    contentType: file.type,
    size: file.size,
  });

  setStatus('uploading');
  await putToPresignedUrl(requested.uploadUrl, file);

  setStatus('confirming');
  const confirmed: FileResponseInterface = await confirmFileUpload(requested.fileId);

  return { fileId: confirmed.id, name: file.name, size: confirmed.size };
}

export function useFileUpload(intent: FileIntentEnum): UseFileUploadResultInterface {
  const [status, setStatus] = useState<FileUploadStatusType>('idle');
  const [error, setError] = useState<ApiErrorInterface | null>(null);
  const [uploads, setUploads] = useState<UploadedFileInterface[]>([]);

  const upload = useCallback(
    async (file: File): Promise<void> => {
      setError(null);
      const validationError: ApiErrorInterface | null = validateFileUpload(file, intent);

      if (validationError) {
        setStatus('error');
        setError(validationError);
        return;
      }

      try {
        const uploaded: UploadedFileInterface = await performUpload(file, intent, setStatus);

        setUploads((previous: UploadedFileInterface[]) => [...previous, uploaded]);
        setStatus('done');
      } catch (caught) {
        setStatus('error');
        setError(toApiError(caught));
      }
    },
    [intent],
  );

  const download = useCallback(async (fileId: string): Promise<void> => {
    setError(null);

    try {
      const target: DownloadUrlResponseInterface = await fetchFileDownloadUrl(fileId);

      window.open(target.downloadUrl, '_blank', 'noopener');
    } catch (caught) {
      setError(toApiError(caught));
    }
  }, []);

  return { status, error, uploads, upload, download };
}
