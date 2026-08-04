import { ApiDefaultResponse } from '@decorators/api-default-response.decorator.js';
import { Serialize } from '@decorators/serialize.decorator.js';
import { AdminScope } from '@modules/casl/decorators/admin-scope.decorator.js';
import { UseAbility } from '@modules/casl/decorators/use-ability.decorator.js';
import { ActionsEnum } from '@modules/casl/enums/actions.enum.js';
import { AccessGuard } from '@modules/casl/guards/access.guard.js';
import { AdminTransactionsQueryDto } from '@modules/payment/dtos/admin-transactions-query.dto.js';
import { AdminTransactionListResponseDto } from '@modules/payment/dtos/responses/admin-transaction-list-response.dto.js';
import { TransactionEntity } from '@modules/payment/entities/transaction.entity.js';
import type { TransactionFiltersInterface } from '@modules/payment/interfaces/transaction-filters.interface.js';
import type { TransactionListInterface } from '@modules/payment/interfaces/transaction-list.interface.js';
import { TransactionService } from '@modules/payment/services/transaction.service.js';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { StatusCodes } from 'http-status-codes';

@ApiBearerAuth()
@ApiTags('Admin transactions')
@UseGuards(AccessGuard)
@AdminScope()
@Controller('admin/transactions')
export class TransactionAdminController {
  constructor(private readonly transactionService: TransactionService) {}

  @ApiDefaultResponse({ status: StatusCodes.OK, type: AdminTransactionListResponseDto })
  @Serialize(AdminTransactionListResponseDto)
  @UseAbility(ActionsEnum.READ, TransactionEntity)
  @Get()
  public findMany(@Query() query: AdminTransactionsQueryDto): Promise<TransactionListInterface> {
    return this.transactionService.findManyForAdmin(
      { cursor: query.cursor, limit: query.limit },
      this.toFilters(query),
    );
  }

  private toFilters(query: AdminTransactionsQueryDto): TransactionFiltersInterface {
    return {
      userId: query.userId ?? null,
      status: query.status ?? null,
      dateFrom: query.dateFrom ? new Date(query.dateFrom) : null,
      dateTo: query.dateTo ? new Date(query.dateTo) : null,
    };
  }
}
