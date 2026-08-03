import { AdminUserResponseDto } from '@modules/user/dtos/responses/admin-user-response.dto.js';
import type { AdminUserListResponseInterface } from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

@Exclude()
export class AdminUserListResponseDto implements AdminUserListResponseInterface {
  @ApiProperty({ type: [AdminUserResponseDto] })
  @Expose()
  @Type(() => AdminUserResponseDto)
  readonly items: AdminUserResponseDto[];

  @ApiProperty({ type: String, nullable: true, example: null })
  @Expose()
  readonly nextCursor: string | null;
}
