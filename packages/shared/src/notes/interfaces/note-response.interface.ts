import type { NoteStatusEnum } from '../enums/note-status.enum.js';

export interface NoteResponseInterface {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly status: NoteStatusEnum;
  readonly createdAt: string;
  readonly updatedAt: string;
}
