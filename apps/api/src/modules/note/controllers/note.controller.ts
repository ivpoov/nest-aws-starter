import { ApiDefaultResponse } from '@decorators/api-default-response.decorator.js';
import { Serialize } from '@decorators/serialize.decorator.js';
import { CursorPaginationQueryDto } from '@modules/common/dtos/cursor-pagination-query.dto.js';
import { CreateNoteDto } from '@modules/note/dtos/create-note.dto.js';
import { NoteListResponseDto } from '@modules/note/dtos/responses/note-list-response.dto.js';
import { NoteResponseDto } from '@modules/note/dtos/responses/note-response.dto.js';
import { UpdateNoteDto } from '@modules/note/dtos/update-note.dto.js';
import type { NoteInterface } from '@modules/note/interfaces/note.interface.js';
import type { NoteListInterface } from '@modules/note/interfaces/note-list.interface.js';
import { NoteService } from '@modules/note/services/note.service.js';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { StatusCodes } from 'http-status-codes';

// Auth, permission and throttling guards join every endpoint in v0.2 — the
// endpoint checklist is completed there.
@ApiTags('Notes')
@Controller('notes')
export class NoteController {
  constructor(private readonly noteService: NoteService) {}

  @ApiDefaultResponse({ status: StatusCodes.CREATED, type: NoteResponseDto })
  @Serialize(NoteResponseDto)
  @Post()
  public create(@Body() dto: CreateNoteDto): Promise<NoteInterface> {
    return this.noteService.create(dto);
  }

  @ApiDefaultResponse({ status: StatusCodes.OK, type: NoteListResponseDto })
  @Serialize(NoteListResponseDto)
  @Get()
  public findMany(@Query() query: CursorPaginationQueryDto): Promise<NoteListInterface> {
    return this.noteService.findMany(query);
  }

  @ApiDefaultResponse({ status: StatusCodes.OK, type: NoteResponseDto })
  @Serialize(NoteResponseDto)
  @Get(':id')
  public findById(@Param('id', ParseUUIDPipe) id: string): Promise<NoteInterface> {
    return this.noteService.findByIdOrThrow(id);
  }

  @ApiDefaultResponse({ status: StatusCodes.OK, type: NoteResponseDto })
  @Serialize(NoteResponseDto)
  @Patch(':id')
  public update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateNoteDto,
  ): Promise<NoteInterface> {
    return this.noteService.update(id, dto);
  }

  @ApiDefaultResponse({ status: StatusCodes.NO_CONTENT })
  @HttpCode(StatusCodes.NO_CONTENT)
  @Delete(':id')
  public deleteById(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.noteService.deleteById(id);
  }
}
