import { ActivityResponseDto } from '@modules/activity/dtos/responses/activity-response.dto.js';
import type { ActivityListResponseInterface } from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

@Exclude()
export class ActivityListResponseDto implements ActivityListResponseInterface {
  @ApiProperty({ type: [ActivityResponseDto] })
  @Expose()
  @Type(() => ActivityResponseDto)
  readonly items: ActivityResponseDto[];

  @ApiProperty({ type: String, nullable: true, example: '01890a5d-ac96-774b-bcce-b302099a8057' })
  @Expose()
  readonly nextCursor: string | null;
}
