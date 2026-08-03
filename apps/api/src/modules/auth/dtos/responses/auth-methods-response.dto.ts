import { AuthMethodResponseDto } from '@modules/auth/dtos/responses/auth-method-response.dto.js';
import type { AuthMethodsResponseInterface } from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

@Exclude()
export class AuthMethodsResponseDto implements AuthMethodsResponseInterface {
  @ApiProperty({ type: [AuthMethodResponseDto] })
  @Expose()
  @Type(() => AuthMethodResponseDto)
  readonly methods: AuthMethodResponseDto[];
}
