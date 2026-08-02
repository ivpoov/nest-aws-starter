import { NoteStatusEnum } from '@nest-aws-starter/shared';

export interface NoteInterface {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly status: NoteStatusEnum;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
