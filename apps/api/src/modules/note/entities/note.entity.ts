import type { NoteInterface } from '@modules/note/interfaces/note.interface.js';
import type { NoteStatusEnum } from '@nest-aws-starter/shared';

// CASL subject class — the ability metadata target for note permissions.
export class NoteEntity implements NoteInterface {
  declare readonly id: string;
  declare readonly userId: string;
  declare readonly title: string;
  declare readonly body: string;
  declare readonly status: NoteStatusEnum;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}
