import type { FileIntentEnum } from '@nest-aws-starter/shared';

export interface CreateFileDataInterface {
  readonly ownerId: string;
  readonly intent: FileIntentEnum;
  readonly key: string;
  readonly contentType: string;
  readonly size: number;
}
