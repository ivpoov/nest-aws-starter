import type { SessionResponseInterface } from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Transform } from 'class-transformer';

@Exclude()
export class SessionResponseDto implements SessionResponseInterface {
  @ApiProperty({ type: String, example: '01890a5d-ac96-774b-bcce-b302099a8057' })
  @Expose()
  readonly id: string;

  @ApiProperty({ type: String, example: 'Firefox on Fedora' })
  @Expose()
  readonly device: string;

  @ApiProperty({ type: String, example: '203.0.113.7' })
  @Expose()
  readonly ip: string;

  @ApiProperty({ type: String, example: '2026-08-03T12:00:00.000Z' })
  @Expose()
  @Transform(({ value }: { value: Date }): string => value.toISOString())
  readonly createdAt: string;

  @ApiProperty({ type: String, example: '2026-08-03T12:00:00.000Z' })
  @Expose()
  @Transform(({ value }: { value: Date }): string => value.toISOString())
  readonly lastActiveAt: string;

  @ApiProperty({ type: Boolean, example: true })
  @Expose()
  readonly isCurrent: boolean;
}
