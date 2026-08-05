import { NotificationResponseDto } from '@modules/notification/dtos/responses/notification-response.dto.js';
import type { NotificationListResponseInterface } from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

@Exclude()
export class NotificationListResponseDto implements NotificationListResponseInterface {
  @ApiProperty({ type: [NotificationResponseDto] })
  @Expose()
  @Type(() => NotificationResponseDto)
  readonly items: NotificationResponseDto[];

  @ApiProperty({ type: String, nullable: true, example: '01890a5d-ac96-774b-bcce-b302099a8057' })
  @Expose()
  readonly nextCursor: string | null;
}
