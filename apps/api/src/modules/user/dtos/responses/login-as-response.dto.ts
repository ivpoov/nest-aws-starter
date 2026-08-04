import type { LoginAsResponseInterface } from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class LoginAsResponseDto implements LoginAsResponseInterface {
  @ApiProperty({ type: String })
  @Expose()
  readonly code: string;
}
