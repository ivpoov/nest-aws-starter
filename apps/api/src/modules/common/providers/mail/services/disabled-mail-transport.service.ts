import { InternalError } from '@modules/common/errors/internal.error.js';
import { MAIL_TRANSPORT_DISABLED } from '@providers/mail/constants/mail-errors.constants.js';
import type { MailTransportInterface } from '@providers/mail/interfaces/mail-transport.interface.js';
import type { SendMailDataInterface } from '@providers/mail/interfaces/send-mail-data.interface.js';

export class DisabledMailTransportService implements MailTransportInterface {
  public send(_data: SendMailDataInterface): Promise<void> {
    throw new InternalError(MAIL_TRANSPORT_DISABLED);
  }
}
