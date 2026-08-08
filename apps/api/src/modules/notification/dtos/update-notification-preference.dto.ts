import {
  NotificationChannelEnum,
  NotificationTypeEnum,
  type UpdateNotificationPreferenceRequestInterface,
} from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum } from 'class-validator';

export class UpdateNotificationPreferenceDto
  implements UpdateNotificationPreferenceRequestInterface
{
  @ApiProperty({ enum: NotificationTypeEnum, example: NotificationTypeEnum.PASSWORD_CHANGED })
  @IsEnum(NotificationTypeEnum)
  readonly type: NotificationTypeEnum;

  @ApiProperty({ enum: NotificationChannelEnum, example: NotificationChannelEnum.EMAIL })
  @IsEnum(NotificationChannelEnum)
  readonly channel: NotificationChannelEnum;

  @ApiProperty({ type: Boolean, example: false })
  @IsBoolean()
  readonly enabled: boolean;
}
