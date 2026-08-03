import { NoteStatusEnum } from '@nest-aws-starter/shared';

export interface CreateNoteDataInterface {
  readonly userId: string;
  readonly title: string;
  readonly body?: string | undefined;
  readonly status?: NoteStatusEnum | undefined;
}
