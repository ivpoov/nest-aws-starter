import type { OauthExchangeRequestInterface } from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class OauthExchangeDto implements OauthExchangeRequestInterface {
  @ApiProperty({ type: String })
  @IsNotEmpty()
  @IsString()
  readonly code: string;
}
