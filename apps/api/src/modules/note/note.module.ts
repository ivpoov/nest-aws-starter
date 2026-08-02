import { NOTE_REPOSITORY } from '@modules/note/constants/note.constants.js';
import { NoteController } from '@modules/note/controllers/note.controller.js';
import { NotePrismaRepository } from '@modules/note/repositories/note-prisma.repository.js';
import { NoteService } from '@modules/note/services/note.service.js';
import { Module } from '@nestjs/common';

@Module({
  controllers: [NoteController],
  providers: [NoteService, { provide: NOTE_REPOSITORY, useClass: NotePrismaRepository }],
  exports: [NoteService],
})
export class NoteModule {}
