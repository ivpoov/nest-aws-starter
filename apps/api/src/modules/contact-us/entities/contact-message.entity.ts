import type { ContactMessageInterface } from '@modules/contact-us/interfaces/contact-message.interface.js';
import type { ContactMessageStatusEnum } from '@nest-aws-starter/shared';

// CASL subject class — the ability metadata target for contact-message permissions.
export class ContactMessageEntity implements ContactMessageInterface {
  declare readonly id: string;
  declare readonly name: string;
  declare readonly email: string;
  declare readonly subject: string;
  declare readonly body: string;
  declare readonly status: ContactMessageStatusEnum;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}
