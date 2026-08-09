import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@constants/pagination.constants.js';
import type { PaginationInterface } from '@interfaces/pagination.interface.js';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

// Offset pagination is for bounded admin tables only — public/high-volume lists
// use CursorPaginationQueryDto.
export class PaginationQueryDto implements PaginationInterface {
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

  @ApiPropertyOptional({ type: Number, example: 0, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  readonly offset: number = 0;
}
