import type { ContactReceivedPayloadInterface } from '@modules/notification/interfaces/contact-received-payload.interface.js';
import type { NotificationContentInterface } from '@modules/notification/interfaces/notification-content.interface.js';

export function buildContactMessageContent(
  payload: ContactReceivedPayloadInterface,
): NotificationContentInterface {
  return {
    title: 'New contact message',
    body: 'A new contact message was received.',
    meta: { contactMessageId: payload.contactMessageId, ip: payload.ip },
  };
}
