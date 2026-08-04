import { ApiKeyResponseDto } from '@modules/api-key/dtos/responses/api-key-response.dto.js';
import type { ApiKeyListResponseInterface } from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

@Exclude()
export class ApiKeyListResponseDto implements ApiKeyListResponseInterface {
  @ApiProperty({ type: [ApiKeyResponseDto] })
  @Expose()
  @Type(() => ApiKeyResponseDto)
  readonly items: ApiKeyResponseDto[];

  @ApiProperty({ type: String, nullable: true, example: null })
  @Expose()
  readonly nextCursor: string | null;
}
