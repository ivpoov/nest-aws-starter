import type { AvatarUploadResponseInterface } from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class AvatarUploadResponseDto implements AvatarUploadResponseInterface {
  @ApiProperty({ type: String, example: 'https://s3.example/starter/avatars/u-1?signature=...' })
  @Expose()
  readonly uploadUrl: string;

  @ApiProperty({ type: String, example: 'avatars/01890a5d-ac96-774b-bcce-b302099a8057' })
  @Expose()
  readonly key: string;
}
