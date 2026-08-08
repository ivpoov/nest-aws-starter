import type { MailContentInterface } from '@modules/notification/interfaces/mail-content.interface.js';

// One generic template for every email-eligible notification type — the
// persisted title/body are already human-readable copy (see the
// builders/*.builder.ts functions the dispatcher uses to write them), so
// there is nothing type-specific left to template here. Plain function, no
// template engine, same precedent as auth/templates and
// suspicious-activity/templates/new-device-alert.template.ts.
export function buildNotificationEmailMail(title: string, body: string): MailContentInterface {
  return {
    subject: title,
    html: [
      `<p>${body}</p>`,
      '<p>You can manage this email preference in your account notification settings.</p>',
    ].join('\n'),
  };
}
