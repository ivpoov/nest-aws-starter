import type { CursorPaginationInterface } from '@interfaces/cursor-pagination.interface.js';
import type { ContactMessageInterface } from '@modules/contact-us/interfaces/contact-message.interface.js';
import type { ContactMessageFiltersInterface } from '@modules/contact-us/interfaces/contact-message-filters.interface.js';
import type { CreateContactMessageDataInterface } from '@modules/contact-us/interfaces/create-contact-message-data.interface.js';
import type { ContactMessageStatusEnum } from '@nest-aws-starter/shared';

export interface ContactMessageRepositoryInterface {
  create(data: CreateContactMessageDataInterface): Promise<ContactMessageInterface>;
  findManyAfter(
    pagination: CursorPaginationInterface,
    filters: ContactMessageFiltersInterface,
  ): Promise<ContactMessageInterface[]>;
  updateStatus(
    id: string,
    status: ContactMessageStatusEnum,
  ): Promise<ContactMessageInterface | null>;
}
