import { ApiDefaultResponse } from '@decorators/api-default-response.decorator.js';
import { CurrentUserId } from '@decorators/current-user-id.decorator.js';
import { Serialize } from '@decorators/serialize.decorator.js';
import { NotificationPreferencesResponseDto } from '@modules/notification/dtos/responses/notification-preferences-response.dto.js';
import { UpdateNotificationPreferencesDto } from '@modules/notification/dtos/update-notification-preferences.dto.js';
import type { NotificationPreferenceMatrixItemInterface } from '@modules/notification/interfaces/notification-preference-matrix-item.interface.js';
import { NotificationPreferenceService } from '@modules/notification/services/notification-preference.service.js';
import { Body, Controller, Get, HttpCode, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { StatusCodes } from 'http-status-codes';

// Own-resource, no CASL: same shape as AuthMethodController — a caller's
// notification preferences are always their own, scoped by CurrentUserId,
// no permission matrix needed.
@ApiBearerAuth()
@ApiTags('Notification preferences')
@Controller('notifications/preferences')
export class NotificationPreferenceController {
  constructor(private readonly preferenceService: NotificationPreferenceService) {}

  @ApiDefaultResponse({ status: StatusCodes.OK, type: NotificationPreferencesResponseDto })
  @Serialize(NotificationPreferencesResponseDto)
  @Get()
  public async getMatrix(
    @CurrentUserId() userId: string,
  ): Promise<{ preferences: NotificationPreferenceMatrixItemInterface[] }> {
    return { preferences: await this.preferenceService.getMatrix(userId) };
  }

  @ApiDefaultResponse({ status: StatusCodes.NO_CONTENT })
  @HttpCode(StatusCodes.NO_CONTENT)
  @Put()
  public update(
    @CurrentUserId() userId: string,
    @Body() dto: UpdateNotificationPreferencesDto,
  ): Promise<void> {
    return this.preferenceService.updateMany(userId, dto.preferences);
  }
}
