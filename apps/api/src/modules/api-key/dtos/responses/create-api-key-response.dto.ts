import type { CreateApiKeyResponseInterface } from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Transform } from 'class-transformer';

@Exclude()
export class CreateApiKeyResponseDto implements CreateApiKeyResponseInterface {
  @ApiProperty({ type: String, example: '01890a5d-ac96-774b-bcce-b302099a8057' })
  @Expose()
  readonly id: string;

  @ApiProperty({ type: String, example: 'CI deploy bot' })
  @Expose()
  readonly name: string;

  @ApiProperty({
    type: String,
    example: 'sk_5f2c9c1b6e8a4d3f9b0c1a2e3d4f5a6b7c8d9e0f1a2b3c4d',
    description: 'Shown once — store it now, it cannot be retrieved again',
  })
  @Expose()
  readonly key: string;

  @ApiProperty({ type: String, example: 'sk_5f2c9c' })
  @Expose()
  readonly prefix: string;

  @ApiProperty({ type: String, example: '2026-08-04T12:00:00.000Z' })
  @Expose()
  @Transform(({ value }: { value: Date }): string => value.toISOString())
  readonly createdAt: string;
}
