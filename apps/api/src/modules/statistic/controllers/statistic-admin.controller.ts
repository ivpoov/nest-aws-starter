import { ApiDefaultResponse } from '@decorators/api-default-response.decorator.js';
import { Serialize } from '@decorators/serialize.decorator.js';
import { AdminScope } from '@modules/casl/decorators/admin-scope.decorator.js';
import { UseAbility } from '@modules/casl/decorators/use-ability.decorator.js';
import { ActionsEnum } from '@modules/casl/enums/actions.enum.js';
import { AccessGuard } from '@modules/casl/guards/access.guard.js';
import { StatisticsOverviewResponseDto } from '@modules/statistic/dtos/responses/statistics-overview-response.dto.js';
import { StatisticsSeriesResponseDto } from '@modules/statistic/dtos/responses/statistics-series-response.dto.js';
import { StatisticsSeriesQueryDto } from '@modules/statistic/dtos/statistics-series-query.dto.js';
import { StatisticEntity } from '@modules/statistic/entities/statistic.entity.js';
import type { StatisticsOverviewInterface } from '@modules/statistic/interfaces/statistics-overview.interface.js';
import type { StatisticsSeriesInterface } from '@modules/statistic/interfaces/statistics-series.interface.js';
import { StatisticService } from '@modules/statistic/services/statistic.service.js';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { StatusCodes } from 'http-status-codes';

@ApiBearerAuth()
@ApiTags('Admin statistics')
@UseGuards(AccessGuard)
@AdminScope()
@Controller('admin/statistics')
export class StatisticAdminController {
  constructor(private readonly statisticService: StatisticService) {}

  @ApiDefaultResponse({ status: StatusCodes.OK, type: StatisticsOverviewResponseDto })
  @Serialize(StatisticsOverviewResponseDto)
  @UseAbility(ActionsEnum.READ, StatisticEntity)
  @Get('overview')
  public getOverview(): Promise<StatisticsOverviewInterface> {
    return this.statisticService.getOverview();
  }

  @ApiDefaultResponse({ status: StatusCodes.OK, type: StatisticsSeriesResponseDto })
  @Serialize(StatisticsSeriesResponseDto)
  @UseAbility(ActionsEnum.READ, StatisticEntity)
  @Get('series')
  public getSeries(@Query() query: StatisticsSeriesQueryDto): Promise<StatisticsSeriesInterface> {
    return this.statisticService.getSeries(query.metric, query.days);
  }
}
