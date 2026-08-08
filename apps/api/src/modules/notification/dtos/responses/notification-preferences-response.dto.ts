import { NotificationPreferenceResponseDto } from '@modules/notification/dtos/responses/notification-preference-response.dto.js';
import type { NotificationPreferencesResponseInterface } from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

@Exclude()
export class NotificationPreferencesResponseDto
  implements NotificationPreferencesResponseInterface
{
  @ApiProperty({ type: [NotificationPreferenceResponseDto] })
  @Expose()
  @Type(() => NotificationPreferenceResponseDto)
  readonly preferences: NotificationPreferenceResponseDto[];
}
