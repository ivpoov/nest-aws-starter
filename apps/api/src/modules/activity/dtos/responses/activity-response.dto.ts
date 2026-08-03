import { type ActivityResponseInterface, ActivityTypeEnum } from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Transform } from 'class-transformer';

// The wire tells the truth: dates cross HTTP as ISO-8601 strings, so the DTO
// implements the shared wire contract, not the Date-carrying domain interface.
@Exclude()
export class ActivityResponseDto implements ActivityResponseInterface {
  @ApiProperty({ type: String, example: '01890a5d-ac96-774b-bcce-b302099a8057' })
  @Expose()
  readonly id: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '01890a5d-0000-774b-bcce-b30209990001',
  })
  @Expose()
  readonly userId: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '01890a5d-0000-774b-bcce-b30209990001',
  })
  @Expose()
  readonly actorId: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '01890a5d-0000-774b-bcce-b30209990002',
  })
  @Expose()
  readonly sessionId: string | null;

  @ApiProperty({ enum: ActivityTypeEnum, example: ActivityTypeEnum.AUTH_LOGIN })
  @Expose()
  readonly type: ActivityTypeEnum;

  @ApiProperty({ type: Object, nullable: true, example: { email: 'user@example.com' } })
  @Expose()
  readonly meta: Record<string, unknown> | null;

  @ApiProperty({ type: String, nullable: true, example: '127.0.0.1' })
  @Expose()
  readonly ip: string | null;

  @ApiProperty({ type: String, example: '2026-08-03T12:00:00.000Z' })
  @Expose()
  @Transform(({ value }: { value: Date }): string => value.toISOString())
  readonly createdAt: string;
}
