import { mailConfig } from '@configs/mail.config.js';
import { InternalError } from '@modules/common/errors/internal.error.js';
import { DisabledMailTransportService } from '@providers/mail/services/disabled-mail-transport.service.js';
import { SesMailTransportService } from '@providers/mail/services/ses-mail-transport.service.js';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('mailConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('skips all validation when disabled', () => {
    vi.stubEnv('MAIL_ENABLED', 'false');
    vi.stubEnv('MAIL_FROM_ADDRESS', '');

    expect(mailConfig()).toEqual({ isEnabled: false });
  });

  it('fails boot when enabled with an invalid from address', () => {
    vi.stubEnv('MAIL_ENABLED', 'true');
    vi.stubEnv('AWS_REGION', 'us-east-1');
    vi.stubEnv('MAIL_FROM_ADDRESS', 'not-an-email');

    expect(() => mailConfig()).toThrow(/Invalid configuration/);
  });

  it('accepts a complete enabled configuration', () => {
    vi.stubEnv('MAIL_ENABLED', 'true');
    vi.stubEnv('AWS_REGION', 'us-east-1');
    vi.stubEnv('MAIL_FROM_ADDRESS', 'no-reply@example.com');

    expect(mailConfig()).toMatchObject({ isEnabled: true, fromAddress: 'no-reply@example.com' });
  });
});

describe('DisabledMailTransportService', () => {
  it('throws the coded disabled error', () => {
    const transport: DisabledMailTransportService = new DisabledMailTransportService();

    try {
      void transport.send({ to: 'a@b.c', subject: 's', html: '<p>x</p>' });
      expect.unreachable('should have thrown');
    } catch (caught) {
      expect(caught).toBeInstanceOf(InternalError);
      expect((caught as InternalError).args.code).toBe('MAIL_TRANSPORT_DISABLED');
    }
  });
});

describe('SesMailTransportService', () => {
  it('sends through the ses client with the configured from address', async () => {
    const transport: SesMailTransportService = new SesMailTransportService({
      isEnabled: true,
      region: 'us-east-1',
      fromAddress: 'no-reply@example.com',
    });
    const send = vi.fn().mockResolvedValue({});

    // biome-ignore lint/suspicious/noExplicitAny: reaching into the private client for mocking
    (transport as any).client.send = send;

    await transport.send({ to: 'user@example.com', subject: 'Hi', html: '<p>Hi</p>' });

    expect(send).toHaveBeenCalledOnce();

    const command = send.mock.calls[0]?.[0] as {
      input: { Source: string; Destination: { ToAddresses: string[] } };
    };

    expect(command.input.Source).toBe('no-reply@example.com');
    expect(command.input.Destination.ToAddresses).toEqual(['user@example.com']);
  });
});
