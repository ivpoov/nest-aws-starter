import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as filesApi from '../apis/files';
import * as notesApi from '../apis/notes';
import { NotesPage } from '../pages/NotesPage';

vi.mock('../apis/notes');
vi.mock('../apis/files');
vi.mock('../utils/apiClient', () => ({
  apiClient: { uploadToUrl: vi.fn().mockResolvedValue(undefined) },
}));

function attachmentFile(name: string, sizeBytes: number, type: string): File {
  return new File([new Uint8Array(sizeBytes)], name, { type });
}

describe('Attachments (demo) card', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(notesApi.fetchNotes).mockResolvedValue({ items: [], nextCursor: null });
    vi.mocked(filesApi.requestFileUpload).mockResolvedValue({
      fileId: 'file-1',
      uploadUrl: 'https://upload.example.com/presigned',
      key: 'files/user-1/file-1',
    });
    vi.mocked(filesApi.confirmFileUpload).mockResolvedValue({
      id: 'file-1',
      intent: 'ATTACHMENT',
      key: 'files/user-1/file-1',
      contentType: 'application/pdf',
      size: 2048,
      status: 'READY',
      createdAt: '2026-08-04T00:00:00.000Z',
      updatedAt: '2026-08-04T00:00:00.000Z',
    } as never);
  });

  it('lists an upload after it completes and downloads via a fresh signed url', async () => {
    vi.mocked(filesApi.fetchFileDownloadUrl).mockResolvedValue({
      downloadUrl: 'https://cdn.example.com/signed-1',
    });
    vi.stubGlobal('open', vi.fn());

    render(<NotesPage />);

    const input: HTMLInputElement = await screen.findByLabelText('Attach file');
    const file: File = attachmentFile('report.pdf', 2048, 'application/pdf');

    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText('report.pdf')).toBeInTheDocument();
    expect(screen.getByText('2.0 KB')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Download'));

    await waitFor(() => expect(filesApi.fetchFileDownloadUrl).toHaveBeenCalledWith('file-1'));
    expect(window.open).toHaveBeenCalledWith(
      'https://cdn.example.com/signed-1',
      '_blank',
      'noopener',
    );

    vi.unstubAllGlobals();
  });

  it('shows the session-scoped demo note and an empty state before any upload', async () => {
    render(<NotesPage />);

    expect(
      await screen.findByText(/Demo: uploads listed for this session only/),
    ).toBeInTheDocument();
    expect(screen.getByText('No attachments yet')).toBeInTheDocument();
  });

  it('rejects a disallowed attachment type before calling the api', async () => {
    render(<NotesPage />);

    const input: HTMLInputElement = await screen.findByLabelText('Attach file');
    const file: File = attachmentFile('script.exe', 1024, 'application/x-msdownload');

    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText('This file type is not allowed')).toBeInTheDocument();
    expect(filesApi.requestFileUpload).not.toHaveBeenCalled();
  });
});
