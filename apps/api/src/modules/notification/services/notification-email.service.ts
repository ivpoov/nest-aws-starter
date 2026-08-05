import { type MailConfig, mailConfig } from '@configs/mail.config.js';
import { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
import { NotificationPreferenceService } from '@modules/notification/services/notification-preference.service.js';
import { buildNotificationEmailMail } from '@modules/notification/templates/notification-email.template.js';
import type { AuthMethodInterface } from '@modules/user/interfaces/auth-method.interface.js';
import { UserService } from '@modules/user/services/user.service.js';
import type { NotificationTypeEnum } from '@nest-aws-starter/shared';
import { Inject, Injectable } from '@nestjs/common';
import { MAIL_TRANSPORT } from '@providers/mail/constants/mail.constants.js';
import type { MailTransportInterface } from '@providers/mail/interfaces/mail-transport.interface.js';

// The EMAIL channel of the dispatcher's fan-out. Gated on two independent
// switches (backend.md's "optional providers are enabled, never
// half-configured" + task-5-brief.md's per-user preference) — either one
// off means no send, no error.
@Injectable()
export class NotificationEmailService {
  private readonly logger = new CustomLoggerService(NotificationEmailService.name);

  constructor(
    @Inject(mailConfig.KEY) private readonly config: MailConfig,
    @Inject(MAIL_TRANSPORT) private readonly mailTransport: MailTransportInterface,
    private readonly preferenceService: NotificationPreferenceService,
    private readonly userService: UserService,
  ) {}

  public async sendIfEnabled(
    userId: string,
    type: NotificationTypeEnum,
    title: string,
    body: string,
  ): Promise<void> {
    if (!this.config.isEnabled) {
      this.logger.debug(`Notification email skipped for ${type}: mail is disabled`);

      return;
    }

    if (!(await this.preferenceService.isEmailEnabled(userId, type))) return;

    const method: AuthMethodInterface | null =
      await this.userService.findEmailMethodByUserId(userId);

    if (!method?.email) return;

    await this.mailTransport.send({ to: method.email, ...buildNotificationEmailMail(title, body) });
    this.logger.log(`Notification email sent for user ${userId} (${type})`);
  }
}
