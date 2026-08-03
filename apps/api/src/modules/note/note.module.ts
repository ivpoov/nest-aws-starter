import { CaslModule } from '@modules/casl/casl.module.js';
import { NOTE_REPOSITORY } from '@modules/note/constants/note.constants.js';
import { NoteController } from '@modules/note/controllers/note.controller.js';
import { notePermissions } from '@modules/note/permissions/note.permissions.js';
import { NotePrismaRepository } from '@modules/note/repositories/note-prisma.repository.js';
import { NoteService } from '@modules/note/services/note.service.js';
import { Module } from '@nestjs/common';

@Module({
  imports: [CaslModule.forFeature({ permissions: notePermissions })],
  controllers: [NoteController],
  providers: [NoteService, { provide: NOTE_REPOSITORY, useClass: NotePrismaRepository }],
  exports: [NoteService],
})
export class NoteModule {}
