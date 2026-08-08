import {
  NotificationAudienceEnum,
  type NotificationResponseInterface,
  NotificationTypeEnum,
} from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Transform } from 'class-transformer';

// The wire tells the truth: dates cross HTTP as ISO-8601 strings, so the DTO
// implements the shared wire contract, not the Date-carrying domain
// interface (this also serializes the WS `notification` event payload).
@Exclude()
export class NotificationResponseDto implements NotificationResponseInterface {
  @ApiProperty({ type: String, example: '01890a5d-ac96-774b-bcce-b302099a8057' })
  @Expose()
  readonly id: string;

  @ApiProperty({ enum: NotificationAudienceEnum, example: NotificationAudienceEnum.USER })
  @Expose()
  readonly audience: NotificationAudienceEnum;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '01890a5d-0000-774b-bcce-b30209990001',
  })
  @Expose()
  readonly userId: string | null;

  @ApiProperty({ enum: NotificationTypeEnum, example: NotificationTypeEnum.NEW_DEVICE_LOGIN })
  @Expose()
  readonly type: NotificationTypeEnum;

  @ApiProperty({ type: String, example: 'New device sign-in' })
  @Expose()
  readonly title: string;

  @ApiProperty({ type: String, example: 'A new sign-in to your account was detected.' })
  @Expose()
  readonly body: string;

  @ApiProperty({ type: Object, example: { device: 'Chrome on Fedora' } })
  @Expose()
  readonly meta: Record<string, unknown>;

  @ApiProperty({ type: String, example: '2026-08-05T12:00:00.000Z' })
  @Expose()
  @Transform(({ value }: { value: Date }): string => value.toISOString())
  readonly createdAt: string;

  @ApiProperty({ type: String, nullable: true, example: null })
  @Expose()
  @Transform(({ value }: { value: Date | null }): string | null =>
    value ? value.toISOString() : null,
  )
  readonly readAt: string | null;
}
