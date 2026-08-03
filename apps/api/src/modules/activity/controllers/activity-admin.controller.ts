import { ApiDefaultResponse } from '@decorators/api-default-response.decorator.js';
import { Serialize } from '@decorators/serialize.decorator.js';
import { ActivitiesQueryDto } from '@modules/activity/dtos/activities-query.dto.js';
import { ActivityListResponseDto } from '@modules/activity/dtos/responses/activity-list-response.dto.js';
import { UserActivitiesQueryDto } from '@modules/activity/dtos/user-activities-query.dto.js';
import { ActivityEntity } from '@modules/activity/entities/activity.entity.js';
import type { ActivityFiltersInterface } from '@modules/activity/interfaces/activity-filters.interface.js';
import type { ActivityListInterface } from '@modules/activity/interfaces/activity-list.interface.js';
import { ActivityService } from '@modules/activity/services/activity.service.js';
import { UseAbility } from '@modules/casl/decorators/use-ability.decorator.js';
import { ActionsEnum } from '@modules/casl/enums/actions.enum.js';
import { AccessGuard } from '@modules/casl/guards/access.guard.js';
import { UserService } from '@modules/user/services/user.service.js';
import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { StatusCodes } from 'http-status-codes';

@ApiBearerAuth()
@ApiTags('Admin activities')
@UseGuards(AccessGuard)
@Controller('admin')
export class ActivityAdminController {
  constructor(
    private readonly activityService: ActivityService,
    private readonly userService: UserService,
  ) {}

  @ApiDefaultResponse({ status: StatusCodes.OK, type: ActivityListResponseDto })
  @Serialize(ActivityListResponseDto)
  @UseAbility(ActionsEnum.READ, ActivityEntity)
  @Get('activities')
  public findMany(@Query() query: ActivitiesQueryDto): Promise<ActivityListInterface> {
    return this.activityService.findMany(
      { cursor: query.cursor, limit: query.limit },
      this.toFilters(query),
    );
  }

  @ApiDefaultResponse({ status: StatusCodes.OK, type: ActivityListResponseDto })
  @Serialize(ActivityListResponseDto)
  @UseAbility(ActionsEnum.READ, ActivityEntity)
  @Get('users/:id/activities')
  public async findManyForUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: UserActivitiesQueryDto,
  ): Promise<ActivityListInterface> {
    await this.userService.findByIdForAdminOrThrow(id);

    return this.activityService.findMany(
      { cursor: query.cursor, limit: query.limit },
      { ...this.toFilters(query), userId: id },
    );
  }

  private toFilters(
    query: Pick<ActivitiesQueryDto, 'type' | 'dateFrom' | 'dateTo'> &
      Partial<Pick<ActivitiesQueryDto, 'userId'>>,
  ): ActivityFiltersInterface {
    return {
      userId: query.userId ?? null,
      type: query.type ?? null,
      dateFrom: query.dateFrom ? new Date(query.dateFrom) : null,
      dateTo: query.dateTo ? new Date(query.dateTo) : null,
    };
  }
}
