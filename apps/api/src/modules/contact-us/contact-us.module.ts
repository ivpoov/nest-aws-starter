import { CaslModule } from '@modules/casl/casl.module.js';
import { CONTACT_MESSAGE_REPOSITORY } from '@modules/contact-us/constants/contact-message.constants.js';
import { ContactController } from '@modules/contact-us/controllers/contact.controller.js';
import { ContactMessageAdminController } from '@modules/contact-us/controllers/contact-message-admin.controller.js';
import { contactMessagePermissions } from '@modules/contact-us/permissions/contact-message.permissions.js';
import { ContactMessagePrismaRepository } from '@modules/contact-us/repositories/contact-message-prisma.repository.js';
import { ContactMessageService } from '@modules/contact-us/services/contact-message.service.js';
import { Module } from '@nestjs/common';

@Module({
  imports: [CaslModule.forFeature({ permissions: contactMessagePermissions })],
  controllers: [ContactController, ContactMessageAdminController],
  providers: [
    ContactMessageService,
    { provide: CONTACT_MESSAGE_REPOSITORY, useClass: ContactMessagePrismaRepository },
  ],
  exports: [ContactMessageService],
})
export class ContactUsModule {}
