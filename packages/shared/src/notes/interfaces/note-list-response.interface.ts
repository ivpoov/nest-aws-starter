import { NoteResponseInterface } from './note-response.interface.js';

export interface NoteListResponseInterface {
  readonly items: NoteResponseInterface[];
  readonly nextCursor: string | null;
}
