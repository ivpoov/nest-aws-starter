import { CreateNoteDto } from '@modules/note/dtos/create-note.dto.js';
import type { UpdateNoteRequestInterface } from '@nest-aws-starter/shared';
import { PartialType } from '@nestjs/swagger';

export class UpdateNoteDto
  extends PartialType(CreateNoteDto)
  implements UpdateNoteRequestInterface {}
