import { ContactMessageResponseDto } from '@modules/contact-us/dtos/responses/contact-message-response.dto.js';
import type { ContactMessageListResponseInterface } from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

@Exclude()
export class ContactMessageListResponseDto implements ContactMessageListResponseInterface {
  @ApiProperty({ type: [ContactMessageResponseDto] })
  @Expose()
  @Type(() => ContactMessageResponseDto)
  readonly items: ContactMessageResponseDto[];

  @ApiProperty({ type: String, nullable: true, example: '01890a5d-ac96-774b-bcce-b302099a8057' })
  @Expose()
  readonly nextCursor: string | null;
}
