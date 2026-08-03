import { type NoteResponseInterface, NoteStatusEnum } from '@nest-aws-starter/shared';
import type { ReactElement } from 'react';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';

interface NoteListPropsInterface {
  readonly notes: NoteResponseInterface[];
  readonly onArchiveToggle: (note: NoteResponseInterface) => void;
  readonly onDelete: (id: string) => void;
}

export function NoteList({
  notes,
  onArchiveToggle,
  onDelete,
}: NoteListPropsInterface): ReactElement {
  if (notes.length === 0) return <EmptyState message="No notes yet" />;

  return (
    <ul className="flex flex-col gap-3">
      {notes.map((note: NoteResponseInterface) => (
        <li key={note.id} className="rounded-lg border border-edge p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col">
              <span
                className={
                  note.status === NoteStatusEnum.ARCHIVED ? 'text-content-muted line-through' : ''
                }
              >
                {note.title}
              </span>
              {note.body ? <span className="text-sm text-content-muted">{note.body}</span> : null}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={(): void => onArchiveToggle(note)}>
                {note.status === NoteStatusEnum.ARCHIVED ? 'Restore' : 'Archive'}
              </Button>
              <Button variant="danger" onClick={(): void => onDelete(note.id)}>
                Delete
              </Button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
