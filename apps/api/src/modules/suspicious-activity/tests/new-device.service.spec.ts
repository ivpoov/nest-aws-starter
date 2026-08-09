import type { SuspiciousActivityConfig } from '@configs/suspicious-activity.config.js';
import { parseDevice } from '@helpers/parse-device.helper.js';
import type { SessionContextInterface } from '@modules/session/interfaces/session-context.interface.js';
import type { SessionForUserInterface } from '@modules/session/interfaces/session-for-user.interface.js';
import type { SessionService } from '@modules/session/services/session.service.js';
import { NewDeviceService } from '@modules/suspicious-activity/services/new-device.service.js';
import type { AuthMethodInterface } from '@modules/user/interfaces/auth-method.interface.js';
import type { UserService } from '@modules/user/services/user.service.js';
import type { MailTransportInterface } from '@providers/mail/interfaces/mail-transport.interface.js';
import { describe, expect, it, vi } from 'vitest';

const CHROME_LINUX_USER_AGENT: string =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

// The fixture device must be produced by the same parseDevice() the service
// calls — asserting against a hand-typed string would silently drift the
// moment that helper's output format changes. What the label looks like is
// parse-device.helper.spec.ts's business, not this suite's.
const knownSession: SessionForUserInterface = {
  id: 'session-1',
  userId: 'user-1',
  device: parseDevice(CHROME_LINUX_USER_AGENT),
  ip: '127.0.0.1',
  createdAt: new Date(),
  lastActiveAt: new Date(),
  activeUntil: new Date(Date.now() + 60_000),
  isCurrent: false,
};

interface TestSetupInterface {
  readonly service: NewDeviceService;
  readonly sessionService: { listSessions: ReturnType<typeof vi.fn> };
  readonly userService: { findEmailMethodByUserId: ReturnType<typeof vi.fn> };
  readonly mailTransport: { send: ReturnType<typeof vi.fn> };
}

function createService(config: SuspiciousActivityConfig): TestSetupInterface {
  const sessionService = { listSessions: vi.fn().mockResolvedValue([knownSession]) };
  const userService = {
    findEmailMethodByUserId: vi.fn().mockResolvedValue({
      email: 'user@example.com',
    } as AuthMethodInterface),
  };
  const mailTransport = { send: vi.fn().mockResolvedValue(undefined) };

  const service: NewDeviceService = new NewDeviceService(
    config,
    mailTransport as unknown as MailTransportInterface,
    sessionService as unknown as SessionService,
    userService as unknown as UserService,
  );

  return { service, sessionService, userService, mailTransport };
}

describe('NewDeviceService', () => {
  describe('check', () => {
    it('reports a known device+ip pair as not new', async () => {
      const setup = createService({ newDeviceEmailEnabled: false });
      const context: SessionContextInterface = {
        userAgent: CHROME_LINUX_USER_AGENT,
        ip: '127.0.0.1',
      };

      const result = await setup.service.check('user-1', context);

      expect(result.isNewDevice).toBe(false);
    });

    it('reports an unseen ip on the same device as new', async () => {
      const setup = createService({ newDeviceEmailEnabled: false });
      const context: SessionContextInterface = {
        userAgent: CHROME_LINUX_USER_AGENT,
        ip: '203.0.113.7',
      };

      const result = await setup.service.check('user-1', context);

      expect(result.isNewDevice).toBe(true);
    });

    it('reports a first login (no sessions yet) as a new device', async () => {
      const setup = createService({ newDeviceEmailEnabled: false });

      setup.sessionService.listSessions.mockResolvedValue([]);

      const result = await setup.service.check('user-1', { userAgent: null, ip: '127.0.0.1' });

      expect(result.isNewDevice).toBe(true);
      expect(result.device).toBe('Unknown device');
    });
  });

  describe('sendAlert', () => {
    it('does nothing when NEW_DEVICE_EMAIL_ENABLED is false', async () => {
      const setup = createService({ newDeviceEmailEnabled: false });

      await setup.service.sendAlert('user-1', 'Chrome on Fedora', '127.0.0.1');

      expect(setup.userService.findEmailMethodByUserId).not.toHaveBeenCalled();
      expect(setup.mailTransport.send).not.toHaveBeenCalled();
    });

    it('sends the alert to the user email method when enabled', async () => {
      const setup = createService({ newDeviceEmailEnabled: true });

      await setup.service.sendAlert('user-1', 'Chrome on Fedora', '127.0.0.1');

      expect(setup.mailTransport.send).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'user@example.com' }),
      );
    });

    it('skips silently when the user has no email method', async () => {
      const setup = createService({ newDeviceEmailEnabled: true });

      setup.userService.findEmailMethodByUserId.mockResolvedValue(null);

      await setup.service.sendAlert('user-1', 'Chrome on Fedora', '127.0.0.1');

      expect(setup.mailTransport.send).not.toHaveBeenCalled();
    });
  });
});
