import { CursorPaginationQueryDto } from '@modules/common/dtos/cursor-pagination-query.dto.js';
import { ActivityTypeEnum } from '@nest-aws-starter/shared';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsISO8601, IsOptional, IsUUID } from 'class-validator';

export class ActivitiesQueryDto extends CursorPaginationQueryDto {
  @ApiPropertyOptional({ type: String, example: '01890a5d-0000-774b-bcce-b30209990001' })
  @IsOptional()
  @IsUUID('all')
  readonly userId?: string | undefined;

  @ApiPropertyOptional({ enum: ActivityTypeEnum, example: ActivityTypeEnum.AUTH_LOGIN })
  @IsOptional()
  @IsEnum(ActivityTypeEnum)
  readonly type?: ActivityTypeEnum | undefined;

  @ApiPropertyOptional({ type: String, example: '2026-08-01T00:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  readonly dateFrom?: string | undefined;

  @ApiPropertyOptional({ type: String, example: '2026-08-03T23:59:59.000Z' })
  @IsOptional()
  @IsISO8601()
  readonly dateTo?: string | undefined;
}
