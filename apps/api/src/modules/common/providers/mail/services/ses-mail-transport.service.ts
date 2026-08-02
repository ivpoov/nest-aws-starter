import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
import type { MailTransportInterface } from '@providers/mail/interfaces/mail-transport.interface.js';
import type { SendMailDataInterface } from '@providers/mail/interfaces/send-mail-data.interface.js';
import type { EnabledMailConfigType } from '@providers/mail/types/enabled-mail-config.type.js';

// SES v1 client: SESv2 is not covered by LocalStack Community, and the v1
// SendEmail API is fully sufficient for transactional mail. The MAIL_TRANSPORT
// token makes an SESv2 or SMTP implementation drop-in later.
export class SesMailTransportService implements MailTransportInterface {
  private readonly logger = new CustomLoggerService(SesMailTransportService.name);
  private readonly client: SESClient;

  constructor(private readonly config: EnabledMailConfigType) {
    this.client = new SESClient({
      region: config.region,
      ...(config.endpoint && { endpoint: config.endpoint }),
    });
  }

  public async send(data: SendMailDataInterface): Promise<void> {
    await this.client.send(
      new SendEmailCommand({
        Source: this.config.fromAddress,
        Destination: { ToAddresses: [data.to] },
        Message: {
          Subject: { Data: data.subject },
          Body: { Html: { Data: data.html } },
        },
      }),
    );

    this.logger.log(`Mail sent to: ${data.to}`);
  }
}
