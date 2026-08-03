import { type UpdateUserStatusRequestInterface, UserStatusEnum } from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export class UpdateUserStatusDto implements UpdateUserStatusRequestInterface {
  @ApiProperty({ enum: UserStatusEnum, example: UserStatusEnum.BLOCKED })
  @IsEnum(UserStatusEnum)
  readonly status: UserStatusEnum;
}
