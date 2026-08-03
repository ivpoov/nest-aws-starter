import type { CursorPaginationInterface } from '@interfaces/cursor-pagination.interface.js';
import type { CreateNoteDataInterface } from '@modules/note/interfaces/create-note-data.interface.js';
import type { NoteInterface } from '@modules/note/interfaces/note.interface.js';
import type { UpdateNoteDataType } from '@modules/note/types/update-note-data.type.js';

export interface NoteRepositoryInterface {
  create(data: CreateNoteDataInterface): Promise<NoteInterface>;
  findById(id: string): Promise<NoteInterface | null>;
  findManyAfter(userId: string, pagination: CursorPaginationInterface): Promise<NoteInterface[]>;
  update(id: string, data: UpdateNoteDataType): Promise<NoteInterface | null>;
  deleteById(id: string): Promise<boolean>;
}
