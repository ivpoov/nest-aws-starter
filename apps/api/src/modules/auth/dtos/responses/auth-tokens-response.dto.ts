import type { AuthTokensResponseInterface } from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class AuthTokensResponseDto implements AuthTokensResponseInterface {
  @ApiProperty({ type: String })
  @Expose()
  readonly accessToken: string;

  @ApiProperty({ type: String })
  @Expose()
  readonly refreshToken: string;

  @ApiProperty({ type: Number, example: 900 })
  @Expose()
  readonly expiresInSec: number;
}
