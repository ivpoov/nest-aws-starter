import type { DownloadUrlResponseInterface } from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class DownloadUrlResponseDto implements DownloadUrlResponseInterface {
  @ApiProperty({ type: String, example: 'https://cdn.example.com/files/u1/f1?Signature=...' })
  @Expose()
  readonly downloadUrl: string;
}
