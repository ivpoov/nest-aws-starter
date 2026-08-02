import type { NoteInterface } from '@modules/note/interfaces/note.interface.js';

export interface NoteListInterface {
  readonly items: NoteInterface[];
  readonly nextCursor: string | null;
}
