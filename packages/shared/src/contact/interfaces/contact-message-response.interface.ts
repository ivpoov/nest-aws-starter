import type { ContactMessageStatusEnum } from '../enums/contact-message-status.enum.js';

export interface ContactMessageResponseInterface {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly subject: string;
  readonly body: string;
  readonly status: ContactMessageStatusEnum;
  readonly createdAt: string;
  readonly updatedAt: string;
}
