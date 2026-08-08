import {
  FileIntentEnum, // <module:file>
  type NoteResponseInterface,
  NoteStatusEnum,
} from '@nest-aws-starter/shared';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { AttachmentsCard } from '../components/Attachments/AttachmentsCard'; // <module:file>
import { NoteList } from '../components/Notes/NoteList';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import { Input } from '../components/ui/Input';
import { Loader } from '../components/ui/Loader';
import { useFileUpload } from '../hooks/files/useFileUpload'; // <module:file>
import { useNotes } from '../hooks/notes/useNotes';
import type { UseFileUploadResultInterface } from '../interfaces/use-file-upload-result.interface'; // <module:file>

export function NotesPage(): ReactElement {
  const { notes, hasMore, isLoading, error, loadMore, create, update, remove } = useNotes();
  const fileUpload: UseFileUploadResultInterface = useFileUpload(FileIntentEnum.ATTACHMENT); // <module:file>
  const [title, setTitle] = useState<string>('');

  if (isLoading && notes.length === 0) return <Loader />;
  if (error && notes.length === 0) return <ErrorMessage error={error} />;

  async function handleCreate(): Promise<void> {
    await create({ title });
    setTitle('');
  }

  function handleArchiveToggle(note: NoteResponseInterface): void {
    void update(note.id, {
      status:
        note.status === NoteStatusEnum.ARCHIVED ? NoteStatusEnum.ACTIVE : NoteStatusEnum.ARCHIVED,
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Card title="New note">
        <form
          className="flex items-end gap-3"
          onSubmit={(event): void => {
            event.preventDefault();
            void handleCreate();
          }}
        >
          <div className="grow">
            <Input label="Title" value={title} onChange={setTitle} />
          </div>
          <Button type="submit" isDisabled={title.length === 0}>
            Add
          </Button>
        </form>
      </Card>
      <Card title="Notes">
        <NoteList
          notes={notes}
          onArchiveToggle={handleArchiveToggle}
          onDelete={(id): void => void remove(id)}
        />
        {error ? <p className="mt-3 text-sm text-danger">{error.details}</p> : null}
        {hasMore ? (
          <div className="mt-4">
            <Button variant="ghost" onClick={(): void => void loadMore()}>
              Load more
            </Button>
          </div>
        ) : null}
      </Card>
      {/* <module:file> */}
      <AttachmentsCard
        uploads={fileUpload.uploads}
        status={fileUpload.status}
        error={fileUpload.error}
        onUpload={(file): void => void fileUpload.upload(file)}
        onDownload={(fileId): void => void fileUpload.download(fileId)}
      />
      {/* </module:file> */}
    </div>
  );
}
