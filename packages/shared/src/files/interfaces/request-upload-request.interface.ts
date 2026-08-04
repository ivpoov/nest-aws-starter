import type { FileIntentEnum } from '../enums/file-intent.enum.js';

export interface RequestUploadRequestInterface {
  readonly intent: FileIntentEnum;
  readonly contentType: string;
  readonly size?: number | undefined;
}
