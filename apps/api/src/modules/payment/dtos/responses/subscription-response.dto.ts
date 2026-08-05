import {
  type SubscriptionResponseInterface,
  SubscriptionStatusEnum,
} from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Transform } from 'class-transformer';

@Exclude()
export class SubscriptionResponseDto implements SubscriptionResponseInterface {
  @ApiProperty({ type: String, example: '01890a5d-ac96-774b-bcce-b302099a8057' })
  @Expose()
  readonly id: string;

  @ApiProperty({ type: String, example: '01890a5d-ac96-774b-bcce-b302099a8058' })
  @Expose()
  readonly planId: string;

  @ApiProperty({ type: String, example: 'Pro' })
  @Expose()
  readonly planName: string;

  @ApiProperty({ type: Number, example: 1900 })
  @Expose()
  readonly amountCents: number;

  @ApiProperty({ type: String, example: 'USD' })
  @Expose()
  readonly currency: string;

  @ApiProperty({ enum: SubscriptionStatusEnum, example: SubscriptionStatusEnum.ACTIVE })
  @Expose()
  readonly status: SubscriptionStatusEnum;

  @ApiProperty({ type: String, example: '2026-09-04T12:00:00.000Z' })
  @Expose()
  @Transform(({ value }: { value: Date }): string => value.toISOString())
  readonly currentPeriodEndsAt: string;

  @ApiProperty({ type: String, nullable: true, example: null })
  @Expose()
  @Transform(({ value }: { value: Date | null }): string | null => value?.toISOString() ?? null)
  readonly canceledAt: string | null;
}
