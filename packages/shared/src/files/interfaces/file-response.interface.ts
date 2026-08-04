import type { FileIntentEnum } from '../enums/file-intent.enum.js';
import type { FileStatusEnum } from '../enums/file-status.enum.js';

export interface FileResponseInterface {
  readonly id: string;
  readonly intent: FileIntentEnum;
  readonly key: string;
  readonly contentType: string;
  readonly size: number;
  readonly status: FileStatusEnum;
  readonly createdAt: string;
  readonly updatedAt: string;
}
