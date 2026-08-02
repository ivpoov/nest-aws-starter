import type { PaginationInterface } from '@interfaces/pagination.interface.js';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

// Offset pagination is for bounded admin tables only — public/high-volume lists
// use CursorPaginationQueryDto.
export class PaginationQueryDto implements PaginationInterface {
  @ApiPropertyOptional({ type: Number, example: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  readonly limit: number = 20;

  @ApiPropertyOptional({ type: Number, example: 0, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  readonly offset: number = 0;
}
