import { FileIntentEnum } from '@nest-aws-starter/shared';

export const FILE_UPLOAD_TTL_SEC = 300;
export const FILE_DOWNLOAD_TTL_SEC = 300;

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
