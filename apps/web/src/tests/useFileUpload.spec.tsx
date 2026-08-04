import { FileIntentEnum, FileStatusEnum } from '@nest-aws-starter/shared';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as filesApi from '../apis/files';
import { useFileUpload } from '../hooks/files/useFileUpload';
import { apiClient } from '../utils/apiClient';

vi.mock('../apis/files');
vi.mock('../utils/apiClient', () => ({
  apiClient: { uploadToUrl: vi.fn() },
}));

function textFile(name: string, sizeBytes: number, type: string): File {
  return new File([new Uint8Array(sizeBytes)], name, { type });
}

describe('useFileUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(filesApi.requestFileUpload).mockResolvedValue({
      fileId: 'file-1',
      uploadUrl: 'https://upload.example.com/presigned',
      key: 'files/user-1/file-1',
    });
    vi.mocked(filesApi.confirmFileUpload).mockResolvedValue({
      id: 'file-1',
      intent: FileIntentEnum.ATTACHMENT,
      key: 'files/user-1/file-1',
      contentType: 'application/pdf',
      size: 1024,
      status: FileStatusEnum.READY,
      createdAt: '2026-08-04T00:00:00.000Z',
      updatedAt: '2026-08-04T00:00:00.000Z',
    });
    vi.mocked(apiClient.uploadToUrl).mockResolvedValue(undefined);
  });

  it('sequences request, PUT, and confirm with the correct payloads', async () => {
    const { result } = renderHook(() => useFileUpload(FileIntentEnum.ATTACHMENT));
    const file: File = textFile('report.pdf', 1024, 'application/pdf');

    await act(async (): Promise<void> => {
      await result.current.upload(file);
    });

    expect(filesApi.requestFileUpload).toHaveBeenCalledWith({
      intent: FileIntentEnum.ATTACHMENT,
      contentType: 'application/pdf',
      size: 1024,
    });
    expect(apiClient.uploadToUrl).toHaveBeenCalledWith(
      'https://upload.example.com/presigned',
      file,
      'application/pdf',
    );
    expect(filesApi.confirmFileUpload).toHaveBeenCalledWith('file-1');
    expect(result.current.status).toBe('done');
    expect(result.current.uploads).toEqual([{ fileId: 'file-1', name: 'report.pdf', size: 1024 }]);
  });

  it('rejects an oversize file client-side without calling the api', async () => {
    const { result } = renderHook(() => useFileUpload(FileIntentEnum.ATTACHMENT));
    const file: File = textFile('huge.pdf', 11 * 1024 * 1024, 'application/pdf');

    await act(async (): Promise<void> => {
      await result.current.upload(file);
    });

    expect(filesApi.requestFileUpload).not.toHaveBeenCalled();
    expect(result.current.status).toBe('error');
    expect(result.current.error?.code).toBe('FILE_TOO_LARGE');
  });

  it('rejects a disallowed content type client-side without calling the api', async () => {
    const { result } = renderHook(() => useFileUpload(FileIntentEnum.ATTACHMENT));
    const file: File = textFile('script.exe', 1024, 'application/x-msdownload');

    await act(async (): Promise<void> => {
      await result.current.upload(file);
    });

    expect(filesApi.requestFileUpload).not.toHaveBeenCalled();
    expect(result.current.status).toBe('error');
    expect(result.current.error?.code).toBe('FILE_CONTENT_TYPE_NOT_ALLOWED');
  });

  it('surfaces an expired-presign error when the PUT fails', async () => {
    vi.mocked(apiClient.uploadToUrl).mockRejectedValue(new Error('Upload failed: 403'));

    const { result } = renderHook(() => useFileUpload(FileIntentEnum.ATTACHMENT));
    const file: File = textFile('report.pdf', 1024, 'application/pdf');

    await act(async (): Promise<void> => {
      await result.current.upload(file);
    });

    expect(filesApi.confirmFileUpload).not.toHaveBeenCalled();
    expect(result.current.status).toBe('error');
    expect(result.current.error?.details).toBe('Upload link expired, try again');
  });

  it('surfaces a network error when the PUT never reaches the server', async () => {
    vi.mocked(apiClient.uploadToUrl).mockRejectedValue(new TypeError('Failed to fetch'));

    const { result } = renderHook(() => useFileUpload(FileIntentEnum.ATTACHMENT));
    const file: File = textFile('report.pdf', 1024, 'application/pdf');

    await act(async (): Promise<void> => {
      await result.current.upload(file);
    });

    expect(filesApi.confirmFileUpload).not.toHaveBeenCalled();
    expect(result.current.status).toBe('error');
    expect(result.current.error?.code).toBe('FILE_UPLOAD_NETWORK_ERROR');
    expect(result.current.error?.details).toBe(
      'Could not reach the upload service, check your connection and try again',
    );
  });

  it('surfaces a 409 confirm conflict from the backend envelope', async () => {
    vi.mocked(filesApi.confirmFileUpload).mockRejectedValue({
      statusCode: 409,
      code: 'FILE_NOT_UPLOADED',
      details: 'No object was found at the presigned upload location',
      meta: undefined,
      timestamp: '',
      path: '/files/file-1/confirm',
    });

    const { result } = renderHook(() => useFileUpload(FileIntentEnum.ATTACHMENT));
    const file: File = textFile('report.pdf', 1024, 'application/pdf');

    await act(async (): Promise<void> => {
      await result.current.upload(file);
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error?.code).toBe('FILE_NOT_UPLOADED');
    expect(result.current.uploads).toHaveLength(0);
  });

  it('opens a fresh download url in a new tab', async () => {
    vi.mocked(filesApi.fetchFileDownloadUrl).mockResolvedValue({
      downloadUrl: 'https://cdn.example.com/signed',
    });
    vi.stubGlobal('open', vi.fn());

    const { result } = renderHook(() => useFileUpload(FileIntentEnum.ATTACHMENT));

    await act(async (): Promise<void> => {
      await result.current.download('file-1');
    });

    expect(filesApi.fetchFileDownloadUrl).toHaveBeenCalledWith('file-1');
    expect(window.open).toHaveBeenCalledWith(
      'https://cdn.example.com/signed',
      '_blank',
      'noopener',
    );

    vi.unstubAllGlobals();
  });

  it('clears a stale error from a previous failed upload once a download succeeds', async () => {
    vi.mocked(filesApi.fetchFileDownloadUrl).mockResolvedValue({
      downloadUrl: 'https://cdn.example.com/signed',
    });
    vi.stubGlobal('open', vi.fn());

    const { result } = renderHook(() => useFileUpload(FileIntentEnum.ATTACHMENT));
    const validFile: File = textFile('report.pdf', 1024, 'application/pdf');
    const invalidFile: File = textFile('script.exe', 1024, 'application/x-msdownload');

    await act(async (): Promise<void> => {
      await result.current.upload(validFile);
    });
    await act(async (): Promise<void> => {
      await result.current.upload(invalidFile);
    });

    expect(result.current.error?.code).toBe('FILE_CONTENT_TYPE_NOT_ALLOWED');

    await act(async (): Promise<void> => {
      await result.current.download('file-1');
    });

    expect(result.current.error).toBeNull();

    vi.unstubAllGlobals();
  });
});
