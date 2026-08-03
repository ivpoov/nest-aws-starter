import { AuthMethodTypeEnum, type OauthProvidersResponseInterface } from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class OauthProvidersResponseDto implements OauthProvidersResponseInterface {
  @ApiProperty({ enum: AuthMethodTypeEnum, isArray: true, example: [AuthMethodTypeEnum.GOOGLE] })
  @Expose()
  readonly providers: AuthMethodTypeEnum[];
}
