import type { ErrorArgsInterface } from '@interfaces/error-args.interface.js';

export const USER_NOT_FOUND: ErrorArgsInterface = {
  code: 'USER_NOT_FOUND',
  details: 'User not found',
};

export const USER_BLOCKED: ErrorArgsInterface = {
  code: 'USER_BLOCKED',
  details: 'This account is blocked',
};

export const USER_AVATAR_TYPE_NOT_ALLOWED: ErrorArgsInterface = {
  code: 'USER_AVATAR_TYPE_NOT_ALLOWED',
  details: 'Avatar must be a jpeg, png, webp or gif image',
};

export const USER_CANNOT_BLOCK_SELF: ErrorArgsInterface = {
  code: 'USER_CANNOT_BLOCK_SELF',
  details: 'Admins cannot block their own account',
};
