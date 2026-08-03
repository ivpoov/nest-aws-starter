import { ApiDefaultResponse } from '@decorators/api-default-response.decorator.js';
import { CurrentUserId } from '@decorators/current-user-id.decorator.js';
import { Serialize } from '@decorators/serialize.decorator.js';
import { AvatarUploadDto } from '@modules/user/dtos/avatar-upload.dto.js';
import { AvatarUploadResponseDto } from '@modules/user/dtos/responses/avatar-upload-response.dto.js';
import { UserResponseDto } from '@modules/user/dtos/responses/user-response.dto.js';
import { UpdateProfileDto } from '@modules/user/dtos/update-profile.dto.js';
import type { UserProfileInterface } from '@modules/user/interfaces/user-profile.interface.js';
import { ProfileService } from '@modules/user/services/profile.service.js';
import type { AvatarUploadResponseInterface } from '@nest-aws-starter/shared';
import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { StatusCodes } from 'http-status-codes';

@ApiBearerAuth()
@ApiTags('Users')
@Controller('users')
export class UserController {
  constructor(private readonly profileService: ProfileService) {}

  @ApiDefaultResponse({ status: StatusCodes.OK, type: UserResponseDto })
  @Serialize(UserResponseDto)
  @Get('me')
  public getMe(@CurrentUserId() userId: string): Promise<UserProfileInterface> {
    return this.profileService.getProfile(userId);
  }

  @ApiDefaultResponse({ status: StatusCodes.OK, type: UserResponseDto })
  @Serialize(UserResponseDto)
  @Patch('me')
  public updateMe(
    @CurrentUserId() userId: string,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserProfileInterface> {
    return this.profileService.updateDisplayName(userId, dto.displayName);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiDefaultResponse({ status: StatusCodes.CREATED, type: AvatarUploadResponseDto })
  @Serialize(AvatarUploadResponseDto)
  @Post('me/avatar-upload')
  public createAvatarUpload(
    @CurrentUserId() userId: string,
    @Body() dto: AvatarUploadDto,
  ): Promise<AvatarUploadResponseInterface> {
    return this.profileService.createAvatarUpload(userId, dto.contentType);
  }
}
