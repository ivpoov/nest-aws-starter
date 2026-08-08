import { CursorPaginationQueryDto } from '@modules/common/dtos/cursor-pagination-query.dto.js';
import { NotificationAudienceEnum, NotificationTypeEnum } from '@nest-aws-starter/shared';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';

// Wire contract: NotificationsQueryRequestInterface (packages/shared) — the
// DTO mirrors it field for field (query DTOs extend CursorPaginationQueryDto
// rather than `implements`, same as ActivitiesQueryDto).
export class NotificationsQueryDto extends CursorPaginationQueryDto {
  @ApiPropertyOptional({ type: Boolean, example: true })
  @IsOptional()
  @IsBoolean()
  // Explicit string comparison, not @Type(() => Boolean): Boolean('false') is
  // true, so the filter could never be turned off. Same transform as
  // RevokeSessionsQueryDto, the codebase's established boolean-query pattern.
  @Transform(({ value }: { value: unknown }): boolean => value === 'true' || value === true)
  readonly unreadOnly: boolean = false;

  @ApiPropertyOptional({
    enum: NotificationTypeEnum,
    example: NotificationTypeEnum.CONTACT_MESSAGE,
  })
  @IsOptional()
  @IsEnum(NotificationTypeEnum)
  readonly type?: NotificationTypeEnum | undefined;

  @ApiPropertyOptional({ enum: NotificationAudienceEnum, example: NotificationAudienceEnum.ADMIN })
  @IsOptional()
  @IsEnum(NotificationAudienceEnum)
  readonly audience?: NotificationAudienceEnum | undefined;
}
