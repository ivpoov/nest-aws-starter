import { ValidationError } from '@modules/common/errors/validation.error.js';
import type { UserInterface } from '@modules/user/interfaces/user.interface.js';
import { ProfileService } from '@modules/user/services/profile.service.js';
import type { UserService } from '@modules/user/services/user.service.js';
import { UserRoleEnum, UserStatusEnum } from '@nest-aws-starter/shared';
import type { S3ProviderInterface } from '@providers/s3/interfaces/s3-provider.interface.js';
import { describe, expect, it, vi } from 'vitest';

const user: UserInterface = {
  id: 'u-1',
  displayName: 'Igor',
  role: UserRoleEnum.USER,
  status: UserStatusEnum.ACTIVE,
  avatarKey: null,
  createdAt: new Date('2026-08-01T00:00:00Z'),
  updatedAt: new Date('2026-08-01T00:00:00Z'),
};

interface SetupInterface {
  readonly service: ProfileService;
  readonly users: {
    findByIdOrThrow: ReturnType<typeof vi.fn>;
    updateProfile: ReturnType<typeof vi.fn>;
  };
  readonly s3Provider: {
    getPresignedUrl: ReturnType<typeof vi.fn>;
    getPresignedUploadUrl: ReturnType<typeof vi.fn>;
  };
}

function setup(overrides: Partial<UserInterface> = {}): SetupInterface {
  const current: UserInterface = { ...user, ...overrides };
  const users = {
    findByIdOrThrow: vi.fn().mockResolvedValue(current),
    updateProfile: vi.fn().mockResolvedValue(current),
  };
  const s3Provider = {
    getPresignedUrl: vi.fn().mockResolvedValue('https://signed.example/get'),
    getPresignedUploadUrl: vi.fn().mockResolvedValue('https://signed.example/put'),
  };
  const service: ProfileService = new ProfileService(
    users as unknown as UserService,
    s3Provider as unknown as S3ProviderInterface,
  );

  return { service, users, s3Provider };
}

describe('ProfileService', () => {
  it('returns a null avatar url without an avatar key', async () => {
    const { service, s3Provider } = setup();

    const profile = await service.getProfile('u-1');

    expect(profile.avatarUrl).toBeNull();
    expect(s3Provider.getPresignedUrl).not.toHaveBeenCalled();
  });

  it('resolves the avatar key into a presigned url', async () => {
    const { service } = setup({ avatarKey: 'avatars/u-1' });

    const profile = await service.getProfile('u-1');

    expect(profile.avatarUrl).toBe('https://signed.example/get');
  });

  it('pins the upload key to the caller and stores it', async () => {
    const { service, users, s3Provider } = setup();

    const result = await service.createAvatarUpload('u-1', 'image/png');

    expect(result.key).toBe('avatars/u-1');
    expect(result.uploadUrl).toBe('https://signed.example/put');
    expect(s3Provider.getPresignedUploadUrl).toHaveBeenCalledWith('avatars/u-1', 'image/png', 300);
    expect(users.updateProfile).toHaveBeenCalledWith('u-1', { avatarKey: 'avatars/u-1' });
  });

  it('rejects a non-image content type before signing anything', async () => {
    const { service, s3Provider } = setup();

    const caught = await service
      .createAvatarUpload('u-1', 'application/pdf')
      .then(() => null)
      .catch((error: ValidationError): ValidationError => error);

    expect(caught).toBeInstanceOf(ValidationError);
    expect(caught?.args.code).toBe('USER_AVATAR_TYPE_NOT_ALLOWED');
    expect(s3Provider.getPresignedUploadUrl).not.toHaveBeenCalled();
  });
});
