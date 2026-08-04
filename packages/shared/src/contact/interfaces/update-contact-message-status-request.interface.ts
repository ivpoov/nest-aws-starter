import type { ContactMessageStatusEnum } from '../enums/contact-message-status.enum.js';

export interface UpdateContactMessageStatusRequestInterface {
  readonly status: ContactMessageStatusEnum;
}
