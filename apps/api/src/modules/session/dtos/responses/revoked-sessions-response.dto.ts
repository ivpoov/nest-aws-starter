import type { RevokedSessionsResponseInterface } from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class RevokedSessionsResponseDto implements RevokedSessionsResponseInterface {
  @ApiProperty({ type: Number, example: 2 })
  @Expose()
  readonly revokedCount: number;
}
