import { ValidationError } from '@modules/common/errors/validation.error.js';
import {
  ALLOWED_AVATAR_CONTENT_TYPES,
  AVATAR_DISPLAY_TTL_SEC,
  AVATAR_UPLOAD_TTL_SEC,
} from '@modules/user/constants/avatar.constants.js';
import { USER_AVATAR_TYPE_NOT_ALLOWED } from '@modules/user/constants/user-errors.constants.js';
import type { UserInterface } from '@modules/user/interfaces/user.interface.js';
import type { UserProfileInterface } from '@modules/user/interfaces/user-profile.interface.js';
import { UserService } from '@modules/user/services/user.service.js';
import type { AvatarUploadResponseInterface } from '@nest-aws-starter/shared';
import { Inject, Injectable } from '@nestjs/common';
import { S3_PROVIDER } from '@providers/s3/constants/s3.constants.js';
import type { S3ProviderInterface } from '@providers/s3/interfaces/s3-provider.interface.js';

@Injectable()
export class ProfileService {
  constructor(
    private readonly userService: UserService,
    @Inject(S3_PROVIDER) private readonly s3Provider: S3ProviderInterface,
  ) {}

  public async getProfile(userId: string): Promise<UserProfileInterface> {
    const user: UserInterface = await this.userService.findByIdOrThrow(userId);

    return this.withAvatarUrl(user);
  }

  public async updateDisplayName(
    userId: string,
    displayName: string,
  ): Promise<UserProfileInterface> {
    const user: UserInterface = await this.userService.updateProfile(userId, { displayName });

    return this.withAvatarUrl(user);
  }

  // The key is fixed server-side to the caller's own slot — a client can never
  // point its profile at another user's object.
  public async createAvatarUpload(
    userId: string,
    contentType: string,
  ): Promise<AvatarUploadResponseInterface> {
    if (!ALLOWED_AVATAR_CONTENT_TYPES.includes(contentType)) {
      throw new ValidationError(USER_AVATAR_TYPE_NOT_ALLOWED);
    }

    const key: string = `avatars/${userId}`;
    const uploadUrl: string = await this.s3Provider.getPresignedUploadUrl(
      key,
      contentType,
      AVATAR_UPLOAD_TTL_SEC,
    );

    await this.userService.updateProfile(userId, { avatarKey: key });

    return { uploadUrl, key };
  }

  private async withAvatarUrl(user: UserInterface): Promise<UserProfileInterface> {
    const avatarUrl: string | null = user.avatarKey
      ? await this.s3Provider.getPresignedUrl(user.avatarKey, AVATAR_DISPLAY_TTL_SEC)
      : null;

    return { ...user, avatarUrl };
  }
}
