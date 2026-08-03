import type { MailContentInterface } from '@modules/auth/interfaces/mail-content.interface.js';

export function buildVerifyEmailMail(link: string): MailContentInterface {
  return {
    subject: 'Verify your email address',
    html: [
      '<p>Welcome! Please confirm this email address belongs to you.</p>',
      `<p><a href="${link}">Verify email address</a></p>`,
      '<p>The link is valid for 24 hours. If you did not create an account, ignore this mail.</p>',
    ].join('\n'),
  };
}
