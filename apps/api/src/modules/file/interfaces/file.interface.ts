import type { FileIntentEnum, FileStatusEnum } from '@nest-aws-starter/shared';

export interface FileInterface {
  readonly id: string;
  readonly ownerId: string;
  readonly intent: FileIntentEnum;
  readonly key: string;
  readonly contentType: string;
  readonly size: number;
  readonly status: FileStatusEnum;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
