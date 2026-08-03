import {
  type ContactMessageResponseInterface,
  ContactMessageStatusEnum,
} from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Transform } from 'class-transformer';

// The wire tells the truth: dates cross HTTP as ISO-8601 strings, so the DTO
// implements the shared wire contract, not the Date-carrying domain interface.
@Exclude()
export class ContactMessageResponseDto implements ContactMessageResponseInterface {
  @ApiProperty({ type: String, example: '01890a5d-ac96-774b-bcce-b302099a8057' })
  @Expose()
  readonly id: string;

  @ApiProperty({ type: String, example: 'Jane Doe' })
  @Expose()
  readonly name: string;

  @ApiProperty({ type: String, example: 'jane@example.com' })
  @Expose()
  readonly email: string;

  @ApiProperty({ type: String, example: 'Question about pricing' })
  @Expose()
  readonly subject: string;

  @ApiProperty({ type: String, example: 'Hi, I would like to know...' })
  @Expose()
  readonly body: string;

  @ApiProperty({ enum: ContactMessageStatusEnum, example: ContactMessageStatusEnum.OPEN })
  @Expose()
  readonly status: ContactMessageStatusEnum;

  @ApiProperty({ type: String, example: '2026-08-03T12:00:00.000Z' })
  @Expose()
  @Transform(({ value }: { value: Date }): string => value.toISOString())
  readonly createdAt: string;

  @ApiProperty({ type: String, example: '2026-08-03T12:00:00.000Z' })
  @Expose()
  @Transform(({ value }: { value: Date }): string => value.toISOString())
  readonly updatedAt: string;
}
