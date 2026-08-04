import type {
  DownloadUrlResponseInterface,
  FileResponseInterface,
  RequestUploadRequestInterface,
  RequestUploadResponseInterface,
} from '@nest-aws-starter/shared';
import { apiClient } from '../../utils/apiClient';

export function requestFileUpload(
  body: RequestUploadRequestInterface,
): Promise<RequestUploadResponseInterface> {
  return apiClient.post<RequestUploadResponseInterface>('/files/upload-request', body);
}

export function confirmFileUpload(fileId: string): Promise<FileResponseInterface> {
  return apiClient.post<FileResponseInterface>(`/files/${fileId}/confirm`);
}

export function fetchFileDownloadUrl(fileId: string): Promise<DownloadUrlResponseInterface> {
  return apiClient.get<DownloadUrlResponseInterface>(`/files/${fileId}/download-url`);
}
