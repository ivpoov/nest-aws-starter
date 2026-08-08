import { type MailConfig, mailConfig } from '@configs/mail.config.js';
import { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
import { NOTIFICATION_EMAIL_THROTTLE_REPOSITORY } from '@modules/notification/constants/notification-email-throttle.constants.js';
import type { NotificationEmailThrottleRepositoryInterface } from '@modules/notification/interfaces/notification-email-throttle-repository.interface.js';
import { NotificationPreferenceService } from '@modules/notification/services/notification-preference.service.js';
import { buildNotificationEmailMail } from '@modules/notification/templates/notification-email.template.js';
import type { AuthMethodInterface } from '@modules/user/interfaces/auth-method.interface.js';
import { UserService } from '@modules/user/services/user.service.js';
import type { NotificationTypeEnum } from '@nest-aws-starter/shared';
import { Inject, Injectable } from '@nestjs/common';
import { MAIL_TRANSPORT } from '@providers/mail/constants/mail.constants.js';
import type { MailTransportInterface } from '@providers/mail/interfaces/mail-transport.interface.js';

// The EMAIL channel of the dispatcher's fan-out. Gated on three independent
// switches (backend.md §12's "optional providers are enabled, never
// half-configured", §11a's "preferences gate channels, never persistence",
// and the per-(user, type) hourly send window) — any one off means no send,
// no error.
@Injectable()
export class NotificationEmailService {
  private readonly logger = new CustomLoggerService(NotificationEmailService.name);

  constructor(
    @Inject(mailConfig.KEY) private readonly config: MailConfig,
    @Inject(MAIL_TRANSPORT) private readonly mailTransport: MailTransportInterface,
    @Inject(NOTIFICATION_EMAIL_THROTTLE_REPOSITORY)
    private readonly throttleRepository: NotificationEmailThrottleRepositoryInterface,
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

    // Last gate before the transport, so a recipient without an email method
    // never burns the window. Max 1 mail per (user, type) per hour — an
    // event storm persists N rows but sends one mail (the throttle gates the
    // EMAIL channel only, never persistence or the socket push).
    if (!(await this.claimSendSlotSafely(userId, type))) {
      this.logger.debug(`Notification email throttled for user ${userId} (${type})`);

      return;
    }

    await this.mailTransport.send({ to: method.email, ...buildNotificationEmailMail(title, body) });
    this.logger.log(`Notification email sent for user ${userId} (${type})`);
  }

  // A Redis outage must not silently swallow every notification email — the
  // codebase's convention for availability-over-strictness gates (see
  // LoginLockoutService.isLockedSafely): fail open and log loudly. Worst
  // case during an outage is extra mail, never lost mail.
  private async claimSendSlotSafely(userId: string, type: NotificationTypeEnum): Promise<boolean> {
    try {
      return await this.throttleRepository.claim(userId, type);
    } catch (caught) {
      this.logger.warn(`Email throttle check failed, failing open: ${String(caught)}`);

      return true;
    }
  }
}
