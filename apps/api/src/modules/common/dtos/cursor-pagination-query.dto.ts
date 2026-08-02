import type { CursorPaginationInterface } from '@interfaces/cursor-pagination.interface.js';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

// The default list pattern: UUIDv7 ids are time-ordered, so id order is creation order.
export class CursorPaginationQueryDto implements CursorPaginationInterface {
  @ApiPropertyOptional({ type: String, example: '01890a5d-ac96-774b-bcce-b302099a8057' })
  @IsOptional()
  @IsUUID('all')
  readonly cursor: string | null = null;

  @ApiPropertyOptional({ type: Number, example: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  readonly limit: number = 20;
}
