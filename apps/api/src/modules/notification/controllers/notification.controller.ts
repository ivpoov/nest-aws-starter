import { ApiDefaultResponse } from '@decorators/api-default-response.decorator.js';
import { CurrentUser } from '@decorators/current-user.decorator.js';
import { Serialize } from '@decorators/serialize.decorator.js';
import type { CurrentUserInterface } from '@interfaces/current-user.interface.js';
import { UseAbility } from '@modules/casl/decorators/use-ability.decorator.js';
import { ActionsEnum } from '@modules/casl/enums/actions.enum.js';
import { AccessGuard } from '@modules/casl/guards/access.guard.js';
import { NotificationsQueryDto } from '@modules/notification/dtos/notifications-query.dto.js';
import { NotificationListResponseDto } from '@modules/notification/dtos/responses/notification-list-response.dto.js';
import { UnreadCountResponseDto } from '@modules/notification/dtos/responses/unread-count-response.dto.js';
import { NotificationEntity } from '@modules/notification/entities/notification.entity.js';
import type { NotificationListInterface } from '@modules/notification/interfaces/notification-list.interface.js';
import type { NotificationUnreadCountInterface } from '@modules/notification/interfaces/notification-unread-count.interface.js';
import { NotificationService } from '@modules/notification/services/notification.service.js';
import {
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { StatusCodes } from 'http-status-codes';

// Same endpoints serve both roles (task-4-brief.md): audience is resolved
// from the caller's role inside NotificationService, not by a separate
// admin controller — an admin's GET /notifications returns their own
// USER-audience rows merged with every ADMIN-audience row.
@ApiBearerAuth()
@ApiTags('Notifications')
@UseGuards(AccessGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @ApiDefaultResponse({ status: StatusCodes.OK, type: NotificationListResponseDto })
  @Serialize(NotificationListResponseDto)
  @UseAbility(ActionsEnum.READ, NotificationEntity)
  @Get()
  public findMany(
    @CurrentUser() user: CurrentUserInterface,
    @Query() query: NotificationsQueryDto,
  ): Promise<NotificationListInterface> {
    return this.notificationService.findMany(
      user,
      { cursor: query.cursor, limit: query.limit },
      { unreadOnly: query.unreadOnly, type: query.type, audience: query.audience },
    );
  }

  @ApiDefaultResponse({ status: StatusCodes.OK, type: UnreadCountResponseDto })
  @Serialize(UnreadCountResponseDto)
  @UseAbility(ActionsEnum.READ, NotificationEntity)
  @Get('unread-count')
  public countUnread(
    @CurrentUser() user: CurrentUserInterface,
  ): Promise<NotificationUnreadCountInterface> {
    return this.notificationService.countUnread(user);
  }

  @ApiDefaultResponse({ status: StatusCodes.NO_CONTENT })
  @UseAbility(ActionsEnum.UPDATE, NotificationEntity)
  @HttpCode(StatusCodes.NO_CONTENT)
  @Patch(':id/read')
  public markRead(
    @CurrentUser() user: CurrentUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.notificationService.markRead(id, user);
  }

  @ApiDefaultResponse({ status: StatusCodes.NO_CONTENT })
  @UseAbility(ActionsEnum.UPDATE, NotificationEntity)
  @HttpCode(StatusCodes.NO_CONTENT)
  @Post('read-all')
  public markAllRead(@CurrentUser() user: CurrentUserInterface): Promise<void> {
    return this.notificationService.markAllRead(user);
  }
}
