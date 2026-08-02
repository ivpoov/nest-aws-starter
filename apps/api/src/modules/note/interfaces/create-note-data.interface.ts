import { NoteStatusEnum } from '@modules/note/enums/note-status.enum.js';

export interface CreateNoteDataInterface {
  readonly title: string;
  readonly body?: string | undefined;
  readonly status?: NoteStatusEnum | undefined;
}
