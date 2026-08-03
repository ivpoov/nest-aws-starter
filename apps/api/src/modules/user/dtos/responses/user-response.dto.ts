import { type UserResponseInterface, UserRoleEnum, UserStatusEnum } from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Transform } from 'class-transformer';

@Exclude()
export class UserResponseDto implements UserResponseInterface {
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

  @ApiProperty({ type: String, nullable: true, example: null })
  @Expose()
  readonly avatarUrl: string | null;

  @ApiProperty({ type: String, example: '2026-08-03T12:00:00.000Z' })
  @Expose()
  @Transform(({ value }: { value: Date }): string => value.toISOString())
  readonly createdAt: string;

  @ApiProperty({ type: String, example: '2026-08-03T12:00:00.000Z' })
  @Expose()
  @Transform(({ value }: { value: Date }): string => value.toISOString())
  readonly updatedAt: string;
}
