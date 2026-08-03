import { CursorPaginationQueryDto } from '@modules/common/dtos/cursor-pagination-query.dto.js';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AdminUsersQueryDto extends CursorPaginationQueryDto {
  @ApiPropertyOptional({ type: String, example: 'igor' })
  @IsOptional()
  @IsString()
  @MaxLength(320)
  readonly search: string | null = null;
}
