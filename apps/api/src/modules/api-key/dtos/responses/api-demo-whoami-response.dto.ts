import type { ApiDemoWhoamiResponseInterface } from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class ApiDemoWhoamiResponseDto implements ApiDemoWhoamiResponseInterface {
  @ApiProperty({ type: String, example: 'CI deploy bot' })
  @Expose()
  readonly keyName: string;
}
