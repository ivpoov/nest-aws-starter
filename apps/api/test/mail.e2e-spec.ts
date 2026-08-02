import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { MAIL_TRANSPORT } from '@providers/mail/constants/mail.constants.js';
import type { MailTransportInterface } from '@providers/mail/interfaces/mail-transport.interface.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './app.factory.js';

describe('SES mail transport (LocalStack)', () => {
  let app: NestFastifyApplication;
  let mail: MailTransportInterface;

  beforeAll(async () => {
    app = await createTestApp();
    mail = app.get<MailTransportInterface>(MAIL_TRANSPORT);
  });

  afterAll(async () => {
    await app.close();
  });

  it('sends a mail through the verified init identity', async () => {
    await expect(
      mail.send({
        to: 'user@example.com',
        subject: 'e2e mail',
        html: '<p>hello from the starter</p>',
      }),
    ).resolves.toBeUndefined();
  });
});
