import { ApiDefaultResponse } from '@decorators/api-default-response.decorator.js';
import { CurrentUserId } from '@decorators/current-user-id.decorator.js';
import { Serialize } from '@decorators/serialize.decorator.js';
import { CreateApiKeyDto } from '@modules/api-key/dtos/create-api-key.dto.js';
import { ApiKeyListResponseDto } from '@modules/api-key/dtos/responses/api-key-list-response.dto.js';
import { CreateApiKeyResponseDto } from '@modules/api-key/dtos/responses/create-api-key-response.dto.js';
import { ApiKeyEntity } from '@modules/api-key/entities/api-key.entity.js';
import type { ApiKeyCreatedInterface } from '@modules/api-key/interfaces/api-key-created.interface.js';
import type { ApiKeyListInterface } from '@modules/api-key/interfaces/api-key-list.interface.js';
import { ApiKeyService } from '@modules/api-key/services/api-key.service.js';
import { AdminScope } from '@modules/casl/decorators/admin-scope.decorator.js';
import { UseAbility } from '@modules/casl/decorators/use-ability.decorator.js';
import { ActionsEnum } from '@modules/casl/enums/actions.enum.js';
import { AccessGuard } from '@modules/casl/guards/access.guard.js';
import { CursorPaginationQueryDto } from '@modules/common/dtos/cursor-pagination-query.dto.js';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { StatusCodes } from 'http-status-codes';

@ApiBearerAuth()
@ApiTags('Admin API keys')
@UseGuards(AccessGuard)
@AdminScope()
@Controller('admin/api-keys')
export class ApiKeyAdminController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  // Sensitive like other credential-minting endpoints: modest per-admin budget.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiDefaultResponse({ status: StatusCodes.CREATED, type: CreateApiKeyResponseDto })
  @Serialize(CreateApiKeyResponseDto)
  @UseAbility(ActionsEnum.CREATE, ApiKeyEntity)
  @Post()
  public create(
    @CurrentUserId() actorId: string,
    @Body() dto: CreateApiKeyDto,
  ): Promise<ApiKeyCreatedInterface> {
    return this.apiKeyService.create(dto.name, actorId);
  }

  @ApiDefaultResponse({ status: StatusCodes.OK, type: ApiKeyListResponseDto })
  @Serialize(ApiKeyListResponseDto)
  @UseAbility(ActionsEnum.READ, ApiKeyEntity)
  @Get()
  public findMany(@Query() query: CursorPaginationQueryDto): Promise<ApiKeyListInterface> {
    return this.apiKeyService.findMany(query);
  }

  // Idempotent revoke: unknown id is a 404 (service-owned), a second revoke
  // of an already-revoked key is a no-op 204 — see ApiKeyService.revoke().
  @ApiDefaultResponse({ status: StatusCodes.NO_CONTENT })
  @UseAbility(ActionsEnum.DELETE, ApiKeyEntity)
  @HttpCode(StatusCodes.NO_CONTENT)
  @Delete(':id')
  public revoke(
    @CurrentUserId() actorId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.apiKeyService.revoke(id, actorId);
  }
}
