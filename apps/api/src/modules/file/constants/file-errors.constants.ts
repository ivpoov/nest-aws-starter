import type { ErrorArgsInterface } from '@interfaces/error-args.interface.js';

export const FILE_NOT_FOUND: ErrorArgsInterface = {
  code: 'FILE_NOT_FOUND',
  details: 'File not found',
};

export const FILE_ACCESS_DENIED: ErrorArgsInterface = {
  code: 'FILE_ACCESS_DENIED',
  details: 'This file belongs to another user',
};

export const FILE_CONTENT_TYPE_NOT_ALLOWED: ErrorArgsInterface = {
  code: 'FILE_CONTENT_TYPE_NOT_ALLOWED',
  details: 'Content type is not allowed for this upload intent',
};

export const FILE_TOO_LARGE: ErrorArgsInterface = {
  code: 'FILE_TOO_LARGE',
  details: 'File exceeds the maximum size allowed for this upload intent',
};

export const FILE_NOT_UPLOADED: ErrorArgsInterface = {
  code: 'FILE_NOT_UPLOADED',
  details: 'No object was found at the presigned upload location',
};

export const FILE_NOT_READY: ErrorArgsInterface = {
  code: 'FILE_NOT_READY',
  details: 'File upload has not been confirmed yet',
};
