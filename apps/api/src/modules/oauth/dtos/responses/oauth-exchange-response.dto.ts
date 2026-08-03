import { AuthTokensResponseDto } from '@modules/auth/dtos/responses/auth-tokens-response.dto.js';
import {
  AuthMethodTypeEnum,
  OauthExchangeKindEnum,
  type OauthExchangeResponseInterface,
} from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

@Exclude()
export class OauthExchangeResponseDto implements OauthExchangeResponseInterface {
  @ApiProperty({ enum: OauthExchangeKindEnum, example: OauthExchangeKindEnum.LOGIN })
  @Expose()
  readonly kind: OauthExchangeKindEnum;

  @ApiProperty({ type: AuthTokensResponseDto, nullable: true })
  @Expose()
  @Type(() => AuthTokensResponseDto)
  readonly tokens: AuthTokensResponseDto | null;

  @ApiProperty({ enum: AuthMethodTypeEnum, nullable: true, example: null })
  @Expose()
  readonly linkedProvider: AuthMethodTypeEnum | null;
}
