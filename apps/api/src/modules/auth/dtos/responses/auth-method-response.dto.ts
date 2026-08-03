import { type AuthMethodResponseInterface, AuthMethodTypeEnum } from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Transform } from 'class-transformer';

@Exclude()
export class AuthMethodResponseDto implements AuthMethodResponseInterface {
  @ApiProperty({ enum: AuthMethodTypeEnum, example: AuthMethodTypeEnum.EMAIL })
  @Expose()
  readonly type: AuthMethodTypeEnum;

  @ApiProperty({ type: String, nullable: true, example: 'igor@example.com' })
  @Expose()
  readonly email: string | null;

  @ApiProperty({ type: Boolean, example: true })
  @Expose()
  readonly isEmailVerified: boolean;

  @ApiProperty({ type: String, example: '2026-08-03T12:00:00.000Z' })
  @Expose()
  @Transform(({ value }: { value: Date }): string => value.toISOString())
  readonly createdAt: string;

  @ApiProperty({ type: String, nullable: true, example: null })
  @Expose()
  @Transform(({ value }: { value: Date | null }): string | null =>
    value ? value.toISOString() : null,
  )
  readonly lastUsedAt: string | null;
}
