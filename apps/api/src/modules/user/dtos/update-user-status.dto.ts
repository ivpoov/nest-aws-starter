import { type UpdateUserStatusRequestInterface, UserStatusEnum } from '@nest-aws-starter/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateUserStatusDto implements UpdateUserStatusRequestInterface {
  @ApiProperty({ enum: UserStatusEnum, example: UserStatusEnum.BLOCKED })
  @IsEnum(UserStatusEnum)
  readonly status: UserStatusEnum;

  @ApiPropertyOptional({ type: String, example: 'Repeated ToS violations', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  readonly reason?: string | undefined;
}
