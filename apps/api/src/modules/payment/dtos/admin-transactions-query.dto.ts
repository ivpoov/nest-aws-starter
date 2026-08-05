import { CursorPaginationQueryDto } from '@modules/common/dtos/cursor-pagination-query.dto.js';
import { TransactionStatusEnum } from '@nest-aws-starter/shared';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsISO8601, IsOptional, IsUUID } from 'class-validator';

// Same filter shape as ActivitiesQueryDto — the established admin
// cursor+filters precedent.
export class AdminTransactionsQueryDto extends CursorPaginationQueryDto {
  @ApiPropertyOptional({ type: String, example: '01890a5d-0000-774b-bcce-b30209990001' })
  @IsOptional()
  @IsUUID('all')
  readonly userId?: string | undefined;

  @ApiPropertyOptional({ enum: TransactionStatusEnum, example: TransactionStatusEnum.SUCCEEDED })
  @IsOptional()
  @IsEnum(TransactionStatusEnum)
  readonly status?: TransactionStatusEnum | undefined;

  @ApiPropertyOptional({ type: String, example: '2026-08-01T00:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  readonly dateFrom?: string | undefined;

  @ApiPropertyOptional({ type: String, example: '2026-08-03T23:59:59.000Z' })
  @IsOptional()
  @IsISO8601()
  readonly dateTo?: string | undefined;
}
