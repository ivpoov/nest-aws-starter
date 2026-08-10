import type { ContactReceivedPayloadInterface } from '@modules/notification/interfaces/contact-received-payload.interface.js';
import type { NotificationContentInterface } from '@modules/notification/interfaces/notification-content.interface.js';

export function buildContactMessageContent(
  payload: ContactReceivedPayloadInterface,
): NotificationContentInterface {
  return {
    title: 'Contact form submission received',
    body: 'Someone submitted the public contact form.',
    meta: { contactMessageId: payload.contactMessageId, ip: payload.ip },
  };
}
