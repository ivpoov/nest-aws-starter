import { AdminTransactionResponseDto } from '@modules/payment/dtos/responses/admin-transaction-response.dto.js';
import type { AdminTransactionListResponseInterface } from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

@Exclude()
export class AdminTransactionListResponseDto implements AdminTransactionListResponseInterface {
  @ApiProperty({ type: [AdminTransactionResponseDto] })
  @Expose()
  @Type(() => AdminTransactionResponseDto)
  readonly items: AdminTransactionResponseDto[];

  @ApiProperty({ type: String, nullable: true, example: null })
  @Expose()
  readonly nextCursor: string | null;
}
