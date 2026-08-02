import { NoteStatusEnum } from '@modules/note/enums/note-status.enum.js';

export interface NoteInterface {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly status: NoteStatusEnum;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
