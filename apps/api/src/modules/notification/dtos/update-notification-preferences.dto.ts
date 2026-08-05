import { UpdateNotificationPreferenceDto } from '@modules/notification/dtos/update-notification-preference.dto.js';
import type { UpdateNotificationPreferencesRequestInterface } from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, ValidateNested } from 'class-validator';

export class UpdateNotificationPreferencesDto
  implements UpdateNotificationPreferencesRequestInterface
{
  @ApiProperty({ type: [UpdateNotificationPreferenceDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpdateNotificationPreferenceDto)
  readonly preferences: UpdateNotificationPreferenceDto[];
}
