import { NoteResponseDto } from '@modules/note/dtos/responses/note-response.dto.js';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

@Exclude()
export class NoteListResponseDto {
  @ApiProperty({ type: [NoteResponseDto] })
  @Expose()
  @Type(() => NoteResponseDto)
  readonly items: NoteResponseDto[];

  @ApiProperty({ type: String, nullable: true, example: '01890a5d-ac96-774b-bcce-b302099a8057' })
  @Expose()
  readonly nextCursor: string | null;
}
