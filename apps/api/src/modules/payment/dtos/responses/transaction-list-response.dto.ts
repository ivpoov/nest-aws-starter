import { TransactionResponseDto } from '@modules/payment/dtos/responses/transaction-response.dto.js';
import type { TransactionListResponseInterface } from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

@Exclude()
export class TransactionListResponseDto implements TransactionListResponseInterface {
  @ApiProperty({ type: [TransactionResponseDto] })
  @Expose()
  @Type(() => TransactionResponseDto)
  readonly items: TransactionResponseDto[];

  @ApiProperty({ type: String, nullable: true, example: null })
  @Expose()
  readonly nextCursor: string | null;
}
