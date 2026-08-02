import type { SendMailDataInterface } from '@providers/mail/interfaces/send-mail-data.interface.js';

export interface MailTransportInterface {
  send(data: SendMailDataInterface): Promise<void>;
}
