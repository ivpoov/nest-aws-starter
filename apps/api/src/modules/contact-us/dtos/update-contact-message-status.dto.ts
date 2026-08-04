import {
  ContactMessageStatusEnum,
  type UpdateContactMessageStatusRequestInterface,
} from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export class UpdateContactMessageStatusDto implements UpdateContactMessageStatusRequestInterface {
  @ApiProperty({ enum: ContactMessageStatusEnum, example: ContactMessageStatusEnum.RESOLVED })
  @IsEnum(ContactMessageStatusEnum)
  readonly status: ContactMessageStatusEnum;
}
