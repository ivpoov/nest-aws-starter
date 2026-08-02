import { NoteStatusEnum } from '@modules/note/enums/note-status.enum.js';
import type { NoteInterface } from '@modules/note/interfaces/note.interface.js';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

@Exclude()
export class NoteResponseDto implements NoteInterface {
  @ApiProperty({ type: String, example: '01890a5d-ac96-774b-bcce-b302099a8057' })
  @Expose()
  readonly id: string;

  @ApiProperty({ type: String, example: 'My note' })
  @Expose()
  readonly title: string;

  @ApiProperty({ type: String, example: 'Body text' })
  @Expose()
  readonly body: string;

  @ApiProperty({ enum: NoteStatusEnum, example: NoteStatusEnum.ACTIVE })
  @Expose()
  readonly status: NoteStatusEnum;

  @ApiProperty({ type: Date, example: '2026-08-02T12:00:00.000Z' })
  @Expose()
  @Type(() => Date)
  readonly createdAt: Date;

  @ApiProperty({ type: Date, example: '2026-08-02T12:00:00.000Z' })
  @Expose()
  @Type(() => Date)
  readonly updatedAt: Date;
}
