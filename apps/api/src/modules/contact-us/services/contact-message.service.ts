import type { CursorPaginationInterface } from '@interfaces/cursor-pagination.interface.js';
import { NotFoundError } from '@modules/common/errors/not-found.error.js';
import { CONTACT_MESSAGE_REPOSITORY } from '@modules/contact-us/constants/contact-message.constants.js';
import { CONTACT_MESSAGE_NOT_FOUND } from '@modules/contact-us/constants/contact-message-errors.constants.js';
import type { ContactMessageInterface } from '@modules/contact-us/interfaces/contact-message.interface.js';
import type { ContactMessageFiltersInterface } from '@modules/contact-us/interfaces/contact-message-filters.interface.js';
import type { ContactMessageListInterface } from '@modules/contact-us/interfaces/contact-message-list.interface.js';
import type { ContactMessageRepositoryInterface } from '@modules/contact-us/interfaces/contact-message-repository.interface.js';
import type { CreateContactMessageDataInterface } from '@modules/contact-us/interfaces/create-contact-message-data.interface.js';
import { CONTACT_RECEIVED_EVENT } from '@modules/event/constants/event-names.constants.js';
import { EventBusService } from '@modules/event/services/event-bus.service.js';
import { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
import type { ContactMessageStatusEnum } from '@nest-aws-starter/shared';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class ContactMessageService {
  private readonly logger = new CustomLoggerService(ContactMessageService.name);

  constructor(
    @Inject(CONTACT_MESSAGE_REPOSITORY)
    private readonly contactMessageRepository: ContactMessageRepositoryInterface,
    private readonly eventBus: EventBusService,
  ) {}

  // Honeypot short-circuit: a filled decoy field means a bot, not a visitor —
  // return silently (no error, no persistence) so bots never learn the trap
  // exists. PII-minimal event: only the new message's id and the submitter ip
  // cross into the activity trail, never the name/email/body.
  public async submit(
    data: CreateContactMessageDataInterface,
    honeypot: string | undefined,
    ip: string,
  ): Promise<void> {
    if (honeypot) {
      this.logger.warn('Contact form honeypot triggered — discarding without persisting');

      return;
    }

    const message: ContactMessageInterface = await this.contactMessageRepository.create(data);

    this.logger.log(`Contact message received: ${message.id}`);
    this.eventBus.emit(CONTACT_RECEIVED_EVENT, { contactMessageId: message.id, ip });
  }

  public async findMany(
    pagination: CursorPaginationInterface,
    filters: ContactMessageFiltersInterface,
  ): Promise<ContactMessageListInterface> {
    const items: ContactMessageInterface[] = await this.contactMessageRepository.findManyAfter(
      pagination,
      filters,
    );
    const lastItem: ContactMessageInterface | undefined = items[items.length - 1];
    const nextCursor: string | null =
      items.length === pagination.limit && lastItem ? lastItem.id : null;

    return { items, nextCursor };
  }

  public async updateStatus(
    id: string,
    status: ContactMessageStatusEnum,
  ): Promise<ContactMessageInterface> {
    const message: ContactMessageInterface | null =
      await this.contactMessageRepository.updateStatus(id, status);

    if (!message) throw new NotFoundError(CONTACT_MESSAGE_NOT_FOUND);

    this.logger.log(`Contact message ${id} status set to ${status}`);

    return message;
  }
}
