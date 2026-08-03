import { CursorPaginationQueryDto } from '@modules/common/dtos/cursor-pagination-query.dto.js';
import { ContactMessageStatusEnum } from '@nest-aws-starter/shared';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

export class ContactMessagesQueryDto extends CursorPaginationQueryDto {
  @ApiPropertyOptional({
    enum: ContactMessageStatusEnum,
    example: ContactMessageStatusEnum.OPEN,
  })
  @IsOptional()
  @IsEnum(ContactMessageStatusEnum)
  readonly status?: ContactMessageStatusEnum | undefined;
}
