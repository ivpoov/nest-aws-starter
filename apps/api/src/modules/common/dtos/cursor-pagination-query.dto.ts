import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@constants/pagination.constants.js';
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

  @ApiPropertyOptional({
    type: Number,
    example: DEFAULT_PAGE_SIZE,
    minimum: 1,
    maximum: MAX_PAGE_SIZE,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  @Type(() => Number)
  readonly limit: number = DEFAULT_PAGE_SIZE;
}
