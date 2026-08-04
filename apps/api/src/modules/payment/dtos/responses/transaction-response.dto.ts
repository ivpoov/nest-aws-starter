import { type TransactionResponseInterface, TransactionStatusEnum } from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Transform } from 'class-transformer';

@Exclude()
export class TransactionResponseDto implements TransactionResponseInterface {
  @ApiProperty({ type: String, example: '01890a5d-ac96-774b-bcce-b302099a8057' })
  @Expose()
  readonly id: string;

  @ApiProperty({ enum: TransactionStatusEnum, example: TransactionStatusEnum.SUCCEEDED })
  @Expose()
  readonly status: TransactionStatusEnum;

  @ApiProperty({ type: Number, example: 1900 })
  @Expose()
  readonly amountCents: number;

  @ApiProperty({ type: String, example: 'USD' })
  @Expose()
  readonly currency: string;

  @ApiProperty({ type: String, example: 'STRIPE' })
  @Expose()
  readonly provider: string;

  @ApiProperty({ type: String, example: 'in_1AbCDeFGhIJkLmNoPQrStuVW' })
  @Expose()
  readonly providerRef: string;

  @ApiProperty({ type: String, example: '2026-08-04T12:00:00.000Z' })
  @Expose()
  @Transform(({ value }: { value: Date }): string => value.toISOString())
  readonly createdAt: string;

  @ApiProperty({ type: String, nullable: true, example: '01890a5d-0000-774b-bcce-b302099a0002' })
  @Expose()
  readonly subscriptionId: string | null;
}
