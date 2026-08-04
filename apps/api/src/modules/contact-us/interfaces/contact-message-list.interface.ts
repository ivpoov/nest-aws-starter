import type { ContactMessageInterface } from '@modules/contact-us/interfaces/contact-message.interface.js';

export interface ContactMessageListInterface {
  readonly items: ContactMessageInterface[];
  readonly nextCursor: string | null;
}
