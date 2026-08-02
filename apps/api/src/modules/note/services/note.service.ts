import type { CursorPaginationInterface } from '@interfaces/cursor-pagination.interface.js';
import { NotFoundError } from '@modules/common/errors/not-found.error.js';
import { NOTE_CREATED_EVENT } from '@modules/event/constants/event-names.constants.js';
import { EventBusService } from '@modules/event/services/event-bus.service.js';
import { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
import { NOTE_REPOSITORY } from '@modules/note/constants/note.constants.js';
import { NOTE_NOT_FOUND } from '@modules/note/constants/note-errors.constants.js';
import type { CreateNoteDataInterface } from '@modules/note/interfaces/create-note-data.interface.js';
import type { NoteInterface } from '@modules/note/interfaces/note.interface.js';
import type { NoteListInterface } from '@modules/note/interfaces/note-list.interface.js';
import type { NoteRepositoryInterface } from '@modules/note/interfaces/note-repository.interface.js';
import type { UpdateNoteDataType } from '@modules/note/types/update-note-data.type.js';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class NoteService {
  private readonly logger = new CustomLoggerService(NoteService.name);

  constructor(
    @Inject(NOTE_REPOSITORY)
    private readonly noteRepository: NoteRepositoryInterface,
    private readonly eventBus: EventBusService,
  ) {}

  public async create(data: CreateNoteDataInterface): Promise<NoteInterface> {
    const note: NoteInterface = await this.noteRepository.create(data);

    this.logger.log(`Note created: ${note.id}`);
    this.eventBus.emit(NOTE_CREATED_EVENT, { noteId: note.id });

    return note;
  }

  public async findByIdOrThrow(id: string): Promise<NoteInterface> {
    const note: NoteInterface | null = await this.noteRepository.findById(id);

    if (!note) throw new NotFoundError(NOTE_NOT_FOUND);

    return note;
  }

  public async findMany(pagination: CursorPaginationInterface): Promise<NoteListInterface> {
    const items: NoteInterface[] = await this.noteRepository.findManyAfter(pagination);
    const lastItem: NoteInterface | undefined = items[items.length - 1];
    const nextCursor: string | null =
      items.length === pagination.limit && lastItem ? lastItem.id : null;

    return { items, nextCursor };
  }

  public async update(id: string, data: UpdateNoteDataType): Promise<NoteInterface> {
    await this.findByIdOrThrow(id);

    const note: NoteInterface = await this.noteRepository.update(id, data);

    this.logger.log(`Note updated: ${id}`);

    return note;
  }

  public async deleteById(id: string): Promise<void> {
    await this.findByIdOrThrow(id);
    await this.noteRepository.deleteById(id);

    this.logger.log(`Note deleted: ${id}`);
  }
}
