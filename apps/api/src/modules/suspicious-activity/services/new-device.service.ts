import {
  type SuspiciousActivityConfig,
  suspiciousActivityConfig,
} from '@configs/suspicious-activity.config.js';
import { parseDevice } from '@helpers/parse-device.helper.js';
import { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
import type { SessionContextInterface } from '@modules/session/interfaces/session-context.interface.js';
import type { SessionForUserInterface } from '@modules/session/interfaces/session-for-user.interface.js';
import { SessionService } from '@modules/session/services/session.service.js';
import type { MailContentInterface } from '@modules/suspicious-activity/interfaces/mail-content.interface.js';
import type { NewDeviceCheckInterface } from '@modules/suspicious-activity/interfaces/new-device-check.interface.js';
import { buildNewDeviceAlertMail } from '@modules/suspicious-activity/templates/new-device-alert.template.js';
import type { AuthMethodInterface } from '@modules/user/interfaces/auth-method.interface.js';
import { UserService } from '@modules/user/services/user.service.js';
import { Inject, Injectable } from '@nestjs/common';
import { MAIL_TRANSPORT } from '@providers/mail/constants/mail.constants.js';
import type { MailTransportInterface } from '@providers/mail/interfaces/mail-transport.interface.js';

@Injectable()
export class NewDeviceService {
  private readonly logger = new CustomLoggerService(NewDeviceService.name);

  constructor(
    @Inject(suspiciousActivityConfig.KEY)
    private readonly config: SuspiciousActivityConfig,
    @Inject(MAIL_TRANSPORT) private readonly mailTransport: MailTransportInterface,
    private readonly sessionService: SessionService,
    private readonly userService: UserService,
  ) {}

  // Runs BEFORE the new session is written, so "recent sessions" never
  // includes the session this very login is about to create — no self-match.
  public async check(
    userId: string,
    context: SessionContextInterface,
  ): Promise<NewDeviceCheckInterface> {
    const device: string = parseDevice(context.userAgent);
    const sessions: SessionForUserInterface[] = await this.sessionService.listSessions(userId, '');
    const seenBefore: boolean = sessions.some(
      (session: SessionForUserInterface): boolean =>
        session.device === device && session.ip === context.ip,
    );

    return { isNewDevice: !seenBefore, device };
  }

  // Best-effort, fire-and-forget from the event listener — a mail failure
  // must never surface as an error on an already-completed login.
  public async sendAlert(userId: string, device: string, ip: string): Promise<void> {
    if (!this.config.newDeviceEmailEnabled) return;

    const method: AuthMethodInterface | null =
      await this.userService.findEmailMethodByUserId(userId);

    if (!method?.email) return;

    const mail: MailContentInterface = buildNewDeviceAlertMail(device, ip);

    await this.mailTransport.send({ to: method.email, ...mail });
    this.logger.log(`New-device alert sent for user ${userId}`);
  }
}
