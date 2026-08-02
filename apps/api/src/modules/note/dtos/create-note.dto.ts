import { NoteStatusEnum } from '@modules/note/enums/note-status.enum.js';
import type { CreateNoteDataInterface } from '@modules/note/interfaces/create-note-data.interface.js';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateNoteDto implements CreateNoteDataInterface {
  @ApiProperty({ type: String, example: 'My note', maxLength: 255 })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  readonly title: string;

  @ApiPropertyOptional({ type: String, example: 'Body text' })
  @IsOptional()
  @IsString()
  readonly body?: string | undefined;

  @ApiPropertyOptional({ enum: NoteStatusEnum, example: NoteStatusEnum.ACTIVE })
  @IsOptional()
  @IsEnum(NoteStatusEnum)
  readonly status?: NoteStatusEnum | undefined;
}
