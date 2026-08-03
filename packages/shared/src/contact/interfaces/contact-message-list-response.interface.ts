import type { ContactMessageResponseInterface } from './contact-message-response.interface.js';

export interface ContactMessageListResponseInterface {
  readonly items: ContactMessageResponseInterface[];
  readonly nextCursor: string | null;
}
