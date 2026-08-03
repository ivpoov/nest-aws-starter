import type { NoteStatusEnum } from '../enums/note-status.enum.js';

export interface CreateNoteRequestInterface {
  readonly title: string;
  readonly body?: string | undefined;
  readonly status?: NoteStatusEnum | undefined;
}
