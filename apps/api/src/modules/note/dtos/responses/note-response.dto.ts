import { type NoteResponseInterface, NoteStatusEnum } from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Transform } from 'class-transformer';

// The wire tells the truth: dates cross HTTP as ISO-8601 strings, so the DTO
// implements the shared wire contract, not the Date-carrying domain interface.
@Exclude()
export class NoteResponseDto implements NoteResponseInterface {
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

  @ApiProperty({ type: String, example: '2026-08-02T12:00:00.000Z' })
  @Expose()
  @Transform(({ value }: { value: Date }): string => value.toISOString())
  readonly createdAt: string;

  @ApiProperty({ type: String, example: '2026-08-02T12:00:00.000Z' })
  @Expose()
  @Transform(({ value }: { value: Date }): string => value.toISOString())
  readonly updatedAt: string;
}
