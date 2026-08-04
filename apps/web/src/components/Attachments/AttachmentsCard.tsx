import { type ApiErrorInterface, FileIntentEnum } from '@nest-aws-starter/shared';
import type { ChangeEvent, ReactElement } from 'react';
import { ALLOWED_FILE_CONTENT_TYPES } from '../../constants/file-upload.constants';
import type { UploadedFileInterface } from '../../interfaces/uploaded-file.interface';
import type { FileUploadStatusType } from '../../types/file-upload-status.type';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';

interface AttachmentsCardPropsInterface {
  readonly uploads: UploadedFileInterface[];
  readonly status: FileUploadStatusType;
  readonly error: ApiErrorInterface | null;
  readonly onUpload: (file: File) => void;
  readonly onDownload: (fileId: string) => void;
}

const ACCEPT: string = ALLOWED_FILE_CONTENT_TYPES[FileIntentEnum.ATTACHMENT].join(',');
const BUSY_STATUSES: readonly FileUploadStatusType[] = ['requesting', 'uploading', 'confirming'];

function formatKb(sizeBytes: number): string {
  return `${(sizeBytes / 1024).toFixed(1)} KB`;
}

export function AttachmentsCard({
  uploads,
  status,
  error,
  onUpload,
  onDownload,
}: AttachmentsCardPropsInterface): ReactElement {
  const isBusy: boolean = BUSY_STATUSES.includes(status);

  function handleFile(event: ChangeEvent<HTMLInputElement>): void {
    const file: File | undefined = event.target.files?.[0];

    if (file) onUpload(file);
    event.target.value = '';
  }

  return (
    <Card title="Attachments (demo)">
      <p className="mb-4 text-sm text-content-muted">Demo: uploads listed for this session only.</p>
      <label className="cursor-pointer text-sm text-accent">
        {isBusy ? 'Uploading…' : 'Attach file'}
        <input
          type="file"
          accept={ACCEPT}
          onChange={handleFile}
          disabled={isBusy}
          className="hidden"
        />
      </label>
      {error ? <p className="mt-3 text-sm text-danger">{error.details}</p> : null}
      <div className="mt-4">
        {uploads.length === 0 ? (
          <EmptyState message="No attachments yet" />
        ) : (
          <ul className="flex flex-col gap-2">
            {uploads.map((file: UploadedFileInterface) => (
              <li
                key={file.fileId}
                className="flex items-center justify-between gap-4 rounded-lg border border-edge p-3"
              >
                <div className="flex flex-col">
                  <span>{file.name}</span>
                  <span className="text-xs text-content-muted">{formatKb(file.size)}</span>
                </div>
                <Button variant="ghost" onClick={(): void => onDownload(file.fileId)}>
                  Download
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
