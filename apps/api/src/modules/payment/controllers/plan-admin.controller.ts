import { ApiDefaultResponse } from '@decorators/api-default-response.decorator.js';
import { Serialize } from '@decorators/serialize.decorator.js';
import { AdminScope } from '@modules/casl/decorators/admin-scope.decorator.js';
import { UseAbility } from '@modules/casl/decorators/use-ability.decorator.js';
import { ActionsEnum } from '@modules/casl/enums/actions.enum.js';
import { AccessGuard } from '@modules/casl/guards/access.guard.js';
import { AdminPlansQueryDto } from '@modules/payment/dtos/admin-plans-query.dto.js';
import { CreatePlanDto } from '@modules/payment/dtos/create-plan.dto.js';
import { PlanListResponseDto } from '@modules/payment/dtos/responses/plan-list-response.dto.js';
import { PlanResponseDto } from '@modules/payment/dtos/responses/plan-response.dto.js';
import { UpdatePlanDto } from '@modules/payment/dtos/update-plan.dto.js';
import { UpdatePlanActivationDto } from '@modules/payment/dtos/update-plan-activation.dto.js';
import { PlanEntity } from '@modules/payment/entities/plan.entity.js';
import type { PlanInterface } from '@modules/payment/interfaces/plan.interface.js';
import type { PlanListInterface } from '@modules/payment/interfaces/plan-list.interface.js';
import { PlanAdminService } from '@modules/payment/services/plan-admin.service.js';
import {
  Body,
  Controller,
  Delete,
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

@ApiBearerAuth()
@ApiTags('Admin plans')
@UseGuards(AccessGuard)
@AdminScope()
@Controller('admin/plans')
export class PlanAdminController {
  constructor(private readonly planAdminService: PlanAdminService) {}

  @ApiDefaultResponse({ status: StatusCodes.OK, type: PlanListResponseDto })
  @Serialize(PlanListResponseDto)
  @UseAbility(ActionsEnum.READ, PlanEntity)
  @Get()
  public findMany(@Query() query: AdminPlansQueryDto): Promise<PlanListInterface> {
    return this.planAdminService.findMany({ cursor: query.cursor, limit: query.limit });
  }

  @ApiDefaultResponse({ status: StatusCodes.OK, type: PlanResponseDto })
  @Serialize(PlanResponseDto)
  @UseAbility(ActionsEnum.READ, PlanEntity)
  @Get(':id')
  public findById(@Param('id', ParseUUIDPipe) id: string): Promise<PlanInterface> {
    return this.planAdminService.findByIdOrThrow(id);
  }

  @ApiDefaultResponse({ status: StatusCodes.CREATED, type: PlanResponseDto })
  @Serialize(PlanResponseDto)
  @UseAbility(ActionsEnum.CREATE, PlanEntity)
  @Post()
  public create(@Body() dto: CreatePlanDto): Promise<PlanInterface> {
    return this.planAdminService.create(dto);
  }

  @ApiDefaultResponse({ status: StatusCodes.OK, type: PlanResponseDto })
  @Serialize(PlanResponseDto)
  @UseAbility(ActionsEnum.UPDATE, PlanEntity)
  @Patch(':id')
  public update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlanDto,
  ): Promise<PlanInterface> {
    return this.planAdminService.update(id, dto);
  }

  @ApiDefaultResponse({ status: StatusCodes.OK, type: PlanResponseDto })
  @Serialize(PlanResponseDto)
  @UseAbility(ActionsEnum.UPDATE, PlanEntity)
  @Patch(':id/activation')
  public updateActivation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlanActivationDto,
  ): Promise<PlanInterface> {
    return this.planAdminService.setActive(id, dto.isActive);
  }

  // Deletion is forbidden once a plan has any subscription (any status,
  // past or present) — PLAN_HAS_SUBSCRIPTIONS 409. Use PATCH .../activation
  // to retire a plan that already has subscribers.
  @ApiDefaultResponse({ status: StatusCodes.NO_CONTENT })
  @UseAbility(ActionsEnum.DELETE, PlanEntity)
  @HttpCode(StatusCodes.NO_CONTENT)
  @Delete(':id')
  public deleteById(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.planAdminService.deleteById(id);
  }
}
