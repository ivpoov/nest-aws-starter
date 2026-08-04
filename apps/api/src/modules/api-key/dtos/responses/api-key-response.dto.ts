import type { ApiKeyResponseInterface } from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Transform } from 'class-transformer';

@Exclude()
export class ApiKeyResponseDto implements ApiKeyResponseInterface {
  @ApiProperty({ type: String, example: '01890a5d-ac96-774b-bcce-b302099a8057' })
  @Expose()
  readonly id: string;

  @ApiProperty({ type: String, example: 'CI deploy bot' })
  @Expose()
  readonly name: string;

  @ApiProperty({ type: String, example: 'sk_5f2c9c' })
  @Expose()
  readonly prefix: string;

  @ApiProperty({ type: String, nullable: true, example: null })
  @Expose()
  @Transform(({ value }: { value: Date | null }): string | null => value?.toISOString() ?? null)
  readonly lastUsedAt: string | null;

  @ApiProperty({ type: String, nullable: true, example: null })
  @Expose()
  @Transform(({ value }: { value: Date | null }): string | null => value?.toISOString() ?? null)
  readonly revokedAt: string | null;

  @ApiProperty({ type: String, example: '2026-08-04T12:00:00.000Z' })
  @Expose()
  @Transform(({ value }: { value: Date }): string => value.toISOString())
  readonly createdAt: string;
}
