import { ApiDefaultResponse } from '@decorators/api-default-response.decorator.js';
import { CurrentUserId } from '@decorators/current-user-id.decorator.js';
import { Serialize } from '@decorators/serialize.decorator.js';
import { UseAbility } from '@modules/casl/decorators/use-ability.decorator.js';
import { ActionsEnum } from '@modules/casl/enums/actions.enum.js';
import { AccessGuard } from '@modules/casl/guards/access.guard.js';
import { CursorPaginationQueryDto } from '@modules/common/dtos/cursor-pagination-query.dto.js';
import { CreateNoteDto } from '@modules/note/dtos/create-note.dto.js';
import { NoteListResponseDto } from '@modules/note/dtos/responses/note-list-response.dto.js';
import { NoteResponseDto } from '@modules/note/dtos/responses/note-response.dto.js';
import { UpdateNoteDto } from '@modules/note/dtos/update-note.dto.js';
import { NoteEntity } from '@modules/note/entities/note.entity.js';
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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { StatusCodes } from 'http-status-codes';

@ApiBearerAuth()
@ApiTags('Notes')
@UseGuards(AccessGuard)
@Controller('notes')
export class NoteController {
  constructor(private readonly noteService: NoteService) {}

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiDefaultResponse({ status: StatusCodes.CREATED, type: NoteResponseDto })
  @Serialize(NoteResponseDto)
  @UseAbility(ActionsEnum.CREATE, NoteEntity)
  @Post()
  public create(
    @CurrentUserId() userId: string,
    @Body() dto: CreateNoteDto,
  ): Promise<NoteInterface> {
    return this.noteService.create({ ...dto, userId });
  }

  @ApiDefaultResponse({ status: StatusCodes.OK, type: NoteListResponseDto })
  @Serialize(NoteListResponseDto)
  @UseAbility(ActionsEnum.READ, NoteEntity)
  @Get()
  public findMany(
    @CurrentUserId() userId: string,
    @Query() query: CursorPaginationQueryDto,
  ): Promise<NoteListInterface> {
    return this.noteService.findMany(userId, query);
  }

  @ApiDefaultResponse({ status: StatusCodes.OK, type: NoteResponseDto })
  @Serialize(NoteResponseDto)
  @UseAbility(ActionsEnum.READ, NoteEntity)
  @Get(':id')
  public findById(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<NoteInterface> {
    return this.noteService.findByIdOrThrow(id, userId);
  }

  @ApiDefaultResponse({ status: StatusCodes.OK, type: NoteResponseDto })
  @Serialize(NoteResponseDto)
  @UseAbility(ActionsEnum.UPDATE, NoteEntity)
  @Patch(':id')
  public update(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateNoteDto,
  ): Promise<NoteInterface> {
    return this.noteService.update(id, userId, dto);
  }

  @ApiDefaultResponse({ status: StatusCodes.NO_CONTENT })
  @UseAbility(ActionsEnum.DELETE, NoteEntity)
  @HttpCode(StatusCodes.NO_CONTENT)
  @Delete(':id')
  public deleteById(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.noteService.deleteById(id, userId);
  }
}
