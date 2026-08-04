import type { FileIntentEnum } from '@nest-aws-starter/shared';

export interface FileUploadedPayloadInterface {
  readonly fileId: string;
  readonly userId: string;
  readonly intent: FileIntentEnum;
}
