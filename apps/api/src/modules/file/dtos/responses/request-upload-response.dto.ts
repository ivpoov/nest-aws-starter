import type { RequestUploadResponseInterface } from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class RequestUploadResponseDto implements RequestUploadResponseInterface {
  @ApiProperty({ type: String, example: '01890a5d-ac96-774b-bcce-b302099a8057' })
  @Expose()
  readonly fileId: string;

  @ApiProperty({ type: String, example: 'https://s3.example/starter/files/u1/f1?signature=...' })
  @Expose()
  readonly uploadUrl: string;

  @ApiProperty({ type: String, example: 'files/01890a5d.../7f000000-0000-0000-0000-000000000000' })
  @Expose()
  readonly key: string;
}
