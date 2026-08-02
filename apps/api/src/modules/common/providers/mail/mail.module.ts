import { type MailConfig, mailConfig } from '@configs/mail.config.js';
import { Global, Module } from '@nestjs/common';
import { MAIL_TRANSPORT } from '@providers/mail/constants/mail.constants.js';
import type { MailTransportInterface } from '@providers/mail/interfaces/mail-transport.interface.js';
import { DisabledMailTransportService } from '@providers/mail/services/disabled-mail-transport.service.js';
import { SesMailTransportService } from '@providers/mail/services/ses-mail-transport.service.js';

@Global()
@Module({
  providers: [
    {
      provide: MAIL_TRANSPORT,
      inject: [mailConfig.KEY],
      useFactory: (config: MailConfig): MailTransportInterface =>
        config.isEnabled ? new SesMailTransportService(config) : new DisabledMailTransportService(),
    },
  ],
  exports: [MAIL_TRANSPORT],
})
export class MailModule {}
