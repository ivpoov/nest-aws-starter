import {
  NotificationChannelEnum,
  type NotificationPreferenceResponseInterface,
  NotificationTypeEnum,
} from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class NotificationPreferenceResponseDto implements NotificationPreferenceResponseInterface {
  @ApiProperty({ enum: NotificationTypeEnum, example: NotificationTypeEnum.PASSWORD_CHANGED })
  @Expose()
  readonly type: NotificationTypeEnum;

  @ApiProperty({ enum: NotificationChannelEnum, example: NotificationChannelEnum.EMAIL })
  @Expose()
  readonly channel: NotificationChannelEnum;

  @ApiProperty({ type: Boolean, example: true })
  @Expose()
  readonly enabled: boolean;

  @ApiProperty({ type: Boolean, example: true })
  @Expose()
  readonly isEditable: boolean;
}
