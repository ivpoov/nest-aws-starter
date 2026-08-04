import type { ApiErrorInterface, FileIntentEnum } from '@nest-aws-starter/shared';
import {
  ALLOWED_FILE_CONTENT_TYPES,
  FILE_MAX_SIZE_BYTES,
} from '../constants/file-upload.constants';
import { buildClientError } from './buildClientError';

export function validateFileUpload(file: File, intent: FileIntentEnum): ApiErrorInterface | null {
  if (!ALLOWED_FILE_CONTENT_TYPES[intent].includes(file.type)) {
    return buildClientError('FILE_CONTENT_TYPE_NOT_ALLOWED', 'This file type is not allowed');
  }

  if (file.size > FILE_MAX_SIZE_BYTES[intent]) {
    return buildClientError(
      'FILE_TOO_LARGE',
      'File exceeds the maximum size allowed for this upload',
    );
  }

  return null;
}
