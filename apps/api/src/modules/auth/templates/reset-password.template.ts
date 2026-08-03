import type { MailContentInterface } from '@modules/auth/interfaces/mail-content.interface.js';

export function buildResetPasswordMail(link: string): MailContentInterface {
  return {
    subject: 'Reset your password',
    html: [
      '<p>A password reset was requested for your account.</p>',
      `<p><a href="${link}">Choose a new password</a></p>`,
      '<p>The link is valid for 1 hour and can be used once. If this was not you, ignore this mail — your password stays unchanged.</p>',
    ].join('\n'),
  };
}
