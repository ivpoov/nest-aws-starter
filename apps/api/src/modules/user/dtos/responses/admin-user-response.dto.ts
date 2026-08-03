import {
  type AdminUserResponseInterface,
  AuthMethodTypeEnum,
  UserRoleEnum,
  UserStatusEnum,
} from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Transform } from 'class-transformer';

@Exclude()
export class AdminUserResponseDto implements AdminUserResponseInterface {
  @ApiProperty({ type: String, example: '01890a5d-ac96-774b-bcce-b302099a8057' })
  @Expose()
  readonly id: string;

  @ApiProperty({ type: String, example: 'Igor' })
  @Expose()
  readonly displayName: string;

  @ApiProperty({ enum: UserRoleEnum, example: UserRoleEnum.USER })
  @Expose()
  readonly role: UserRoleEnum;

  @ApiProperty({ enum: UserStatusEnum, example: UserStatusEnum.ACTIVE })
  @Expose()
  readonly status: UserStatusEnum;

  @ApiProperty({ type: String, nullable: true, example: 'igor@example.com' })
  @Expose()
  readonly email: string | null;

  @ApiProperty({ enum: AuthMethodTypeEnum, isArray: true, example: [AuthMethodTypeEnum.EMAIL] })
  @Expose()
  readonly methodTypes: AuthMethodTypeEnum[];

  @ApiProperty({ type: String, example: '2026-08-03T12:00:00.000Z' })
  @Expose()
  @Transform(({ value }: { value: Date }): string => value.toISOString())
  readonly createdAt: string;

  @ApiProperty({ type: String, example: '2026-08-03T12:00:00.000Z' })
  @Expose()
  @Transform(({ value }: { value: Date }): string => value.toISOString())
  readonly updatedAt: string;
}
