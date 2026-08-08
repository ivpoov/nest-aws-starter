import type { UnreadCountResponseInterface } from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class UnreadCountResponseDto implements UnreadCountResponseInterface {
  @ApiProperty({ type: Number, example: 3 })
  @Expose()
  readonly count: number;
}
