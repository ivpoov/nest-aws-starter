import { FileIntentEnum } from '@nest-aws-starter/shared';

// Mirrors apps/api/src/modules/file/constants/file-upload.constants.ts —
// keep both in sync when the backend allowlists or caps change.
const AVATAR_MAX_SIZE_BYTES = 2 * 1024 * 1024;
const ATTACHMENT_MAX_SIZE_BYTES = 10 * 1024 * 1024;

export const FILE_MAX_SIZE_BYTES: Readonly<Record<FileIntentEnum, number>> = {
  [FileIntentEnum.AVATAR]: AVATAR_MAX_SIZE_BYTES,
  [FileIntentEnum.ATTACHMENT]: ATTACHMENT_MAX_SIZE_BYTES,
};

export const ALLOWED_FILE_CONTENT_TYPES: Readonly<Record<FileIntentEnum, readonly string[]>> = {
  [FileIntentEnum.AVATAR]: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  [FileIntentEnum.ATTACHMENT]: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
    'text/plain',
    'application/zip',
  ],
};
