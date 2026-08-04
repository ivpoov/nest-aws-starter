import {
  FileIntentEnum,
  type FileResponseInterface,
  FileStatusEnum,
} from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Transform } from 'class-transformer';

// The wire tells the truth: dates cross HTTP as ISO-8601 strings, so the DTO
// implements the shared wire contract, not the Date-carrying domain interface.
@Exclude()
export class FileResponseDto implements FileResponseInterface {
  @ApiProperty({ type: String, example: '01890a5d-ac96-774b-bcce-b302099a8057' })
  @Expose()
  readonly id: string;

  @ApiProperty({ enum: FileIntentEnum, example: FileIntentEnum.ATTACHMENT })
  @Expose()
  readonly intent: FileIntentEnum;

  @ApiProperty({ type: String, example: 'files/01890a5d.../7f000000-0000-0000-0000-000000000000' })
  @Expose()
  readonly key: string;

  @ApiProperty({ type: String, example: 'image/png' })
  @Expose()
  readonly contentType: string;

  @ApiProperty({ type: Number, example: 102_400 })
  @Expose()
  readonly size: number;

  @ApiProperty({ enum: FileStatusEnum, example: FileStatusEnum.READY })
  @Expose()
  readonly status: FileStatusEnum;

  @ApiProperty({ type: String, example: '2026-08-02T12:00:00.000Z' })
  @Expose()
  @Transform(({ value }: { value: Date }): string => value.toISOString())
  readonly createdAt: string;

  @ApiProperty({ type: String, example: '2026-08-02T12:00:00.000Z' })
  @Expose()
  @Transform(({ value }: { value: Date }): string => value.toISOString())
  readonly updatedAt: string;
}
