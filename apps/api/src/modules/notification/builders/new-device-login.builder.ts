import type { AuthNewDevicePayloadInterface } from '@modules/notification/interfaces/auth-new-device-payload.interface.js';
import type { NotificationContentInterface } from '@modules/notification/interfaces/notification-content.interface.js';

export function buildNewDeviceLoginContent(
  payload: AuthNewDevicePayloadInterface,
): NotificationContentInterface {
  return {
    title: 'New device sign-in',
    body: `A new sign-in to your account was detected from ${payload.device}.`,
    meta: { device: payload.device, ip: payload.ip },
  };
}
