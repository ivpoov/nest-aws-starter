import { type LockoutResponseInterface, LockoutScopeEnum } from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class LockoutResponseDto implements LockoutResponseInterface {
  @ApiProperty({ type: String, example: 'RU1BSUw6dXNlckBleGFtcGxlLmNvbQ' })
  @Expose()
  readonly key: string;

  @ApiProperty({ enum: LockoutScopeEnum, example: LockoutScopeEnum.EMAIL })
  @Expose()
  readonly scope: LockoutScopeEnum;

  @ApiProperty({ type: String, example: 'user@example.com' })
  @Expose()
  readonly value: string;

  @ApiProperty({ type: Number, example: 812 })
  @Expose()
  readonly ttlSec: number;
}
