import type { MailContentInterface } from '@modules/account-security/interfaces/mail-content.interface.js';

export function buildNewDeviceAlertMail(device: string, ip: string): MailContentInterface {
  return {
    subject: 'New sign-in to your account',
    html: [
      `<p>We noticed a sign-in from a device we haven't seen before.</p>`,
      `<p><strong>Device:</strong> ${device}<br/><strong>IP address:</strong> ${ip}</p>`,
      '<p>If this was you, no action is needed. If it was not, change your password immediately.</p>',
    ].join('\n'),
  };
}
