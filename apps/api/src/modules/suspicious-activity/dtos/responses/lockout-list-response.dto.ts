import { LockoutResponseDto } from '@modules/suspicious-activity/dtos/responses/lockout-response.dto.js';
import type { LockoutListResponseInterface } from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

@Exclude()
export class LockoutListResponseDto implements LockoutListResponseInterface {
  @ApiProperty({ type: [LockoutResponseDto] })
  @Expose()
  @Type(() => LockoutResponseDto)
  readonly items: LockoutResponseDto[];
}
