import type { AdminPlanResponseInterface } from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Transform } from 'class-transformer';

@Exclude()
export class PlanResponseDto implements AdminPlanResponseInterface {
  @ApiProperty({ type: String, example: '01890a5d-ac96-774b-bcce-b302099a8057' })
  @Expose()
  readonly id: string;

  @ApiProperty({ type: String, example: 'Starter Monthly' })
  @Expose()
  readonly name: string;

  @ApiProperty({ type: String, example: 'Monthly access to the starter tier' })
  @Expose()
  readonly description: string;

  @ApiProperty({ type: Number, example: 999 })
  @Expose()
  readonly amountCents: number;

  @ApiProperty({ type: String, example: 'USD' })
  @Expose()
  readonly currency: string;

  @ApiProperty({ type: Number, example: 30 })
  @Expose()
  readonly intervalDays: number;

  @ApiProperty({ type: Object, example: { STRIPE: 'price_1AbCDeFGhIJkLmNoPQrStuVW' } })
  @Expose()
  readonly providerRefs: Record<string, string>;

  @ApiProperty({ type: Boolean, example: true })
  @Expose()
  readonly isActive: boolean;

  @ApiProperty({ type: String, example: '2026-08-04T12:00:00.000Z' })
  @Expose()
  @Transform(({ value }: { value: Date }): string => value.toISOString())
  readonly createdAt: string;

  @ApiProperty({ type: String, example: '2026-08-04T12:00:00.000Z' })
  @Expose()
  @Transform(({ value }: { value: Date }): string => value.toISOString())
  readonly updatedAt: string;
}
