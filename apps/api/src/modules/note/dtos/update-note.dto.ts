import { CreateNoteDto } from '@modules/note/dtos/create-note.dto.js';
import { PartialType } from '@nestjs/swagger';

export class UpdateNoteDto extends PartialType(CreateNoteDto) {}
