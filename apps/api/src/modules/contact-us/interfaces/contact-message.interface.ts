import type { ContactMessageStatusEnum } from '@nest-aws-starter/shared';

export interface ContactMessageInterface {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly subject: string;
  readonly body: string;
  readonly status: ContactMessageStatusEnum;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
