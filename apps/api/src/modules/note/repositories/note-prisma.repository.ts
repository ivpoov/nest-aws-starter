import { NoteStatus } from '@generated/prisma/enums.js';
import type { NoteModel } from '@generated/prisma/models.js';
import type { CursorPaginationInterface } from '@interfaces/cursor-pagination.interface.js';
import { NoteStatusEnum } from '@modules/note/enums/note-status.enum.js';
import type { CreateNoteDataInterface } from '@modules/note/interfaces/create-note-data.interface.js';
import type { NoteInterface } from '@modules/note/interfaces/note.interface.js';
import type { NoteRepositoryInterface } from '@modules/note/interfaces/note-repository.interface.js';
import type { UpdateNoteDataType } from '@modules/note/types/update-note-data.type.js';
import { PrismaService } from '@modules/prisma/services/prisma.service.js';
import { Injectable } from '@nestjs/common';

@Injectable()
export class NotePrismaRepository implements NoteRepositoryInterface {
  constructor(private readonly prisma: PrismaService) {}

  public async create(data: CreateNoteDataInterface): Promise<NoteInterface> {
    const note: NoteModel = await this.prisma.note.create({
      data: {
        title: data.title,
        ...(data.body !== undefined && { body: data.body }),
        ...(data.status !== undefined && { status: this.toPrismaStatus(data.status) }),
      },
    });

    return this.toDomain(note);
  }

  public async findById(id: string): Promise<NoteInterface | null> {
    const note: NoteModel | null = await this.prisma.note.findUnique({ where: { id } });

    return note ? this.toDomain(note) : null;
  }

  public async findManyAfter(pagination: CursorPaginationInterface): Promise<NoteInterface[]> {
    const notes: NoteModel[] = await this.prisma.note.findMany({
      take: pagination.limit,
      ...(pagination.cursor && { cursor: { id: pagination.cursor }, skip: 1 }),
      // UUIDv7 ids are time-ordered — id order IS creation order.
      orderBy: { id: 'desc' },
    });

    return notes.map((note: NoteModel): NoteInterface => this.toDomain(note));
  }

  public async update(id: string, data: UpdateNoteDataType): Promise<NoteInterface> {
    const note: NoteModel = await this.prisma.note.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.body !== undefined && { body: data.body }),
        ...(data.status !== undefined && { status: this.toPrismaStatus(data.status) }),
      },
    });

    return this.toDomain(note);
  }

  public async deleteById(id: string): Promise<void> {
    await this.prisma.note.delete({ where: { id } });
  }

  private toDomain(note: NoteModel): NoteInterface {
    return {
      id: note.id,
      title: note.title,
      body: note.body,
      status: NoteStatusEnum[note.status],
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    };
  }

  private toPrismaStatus(status: NoteStatusEnum): NoteStatus {
    return NoteStatus[status];
  }
}
