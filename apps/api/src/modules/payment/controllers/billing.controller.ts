import { ApiDefaultResponse } from '@decorators/api-default-response.decorator.js';
import { CurrentUserId } from '@decorators/current-user-id.decorator.js';
import { Public } from '@decorators/public.decorator.js';
import { Serialize } from '@decorators/serialize.decorator.js';
import { CreateCheckoutDto } from '@modules/payment/dtos/create-checkout.dto.js';
import { CheckoutResponseDto } from '@modules/payment/dtos/responses/checkout-response.dto.js';
import { PublicPlansResponseDto } from '@modules/payment/dtos/responses/public-plans-response.dto.js';
import { SubscriptionResponseDto } from '@modules/payment/dtos/responses/subscription-response.dto.js';
import { TransactionListResponseDto } from '@modules/payment/dtos/responses/transaction-list-response.dto.js';
import { TransactionsQueryDto } from '@modules/payment/dtos/transactions-query.dto.js';
import type { CheckoutSessionInterface } from '@modules/payment/interfaces/checkout-session.interface.js';
import type { PlanInterface } from '@modules/payment/interfaces/plan.interface.js';
import type { SubscriptionInterface } from '@modules/payment/interfaces/subscription.interface.js';
import type { TransactionListInterface } from '@modules/payment/interfaces/transaction-list.interface.js';
import { BillingService } from '@modules/payment/services/billing.service.js';
import { TransactionService } from '@modules/payment/services/transaction.service.js';
import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { StatusCodes } from 'http-status-codes';

@ApiBearerAuth()
@ApiTags('Billing')
@Controller('billing')
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly transactionService: TransactionService,
  ) {}

  // Public: the pricing page renders before any session exists. Only active
  // plans, and only the public-safe fields (no providerRefs, no isActive —
  // see PublicPlanResponseDto).
  @Public()
  @ApiDefaultResponse({ status: StatusCodes.OK, type: PublicPlansResponseDto })
  @Serialize(PublicPlansResponseDto)
  @Get('plans')
  public async listPlans(): Promise<{ items: PlanInterface[] }> {
    const items: PlanInterface[] = await this.billingService.listActivePlans();

    return { items };
  }

  // Not a resource-creation endpoint (nothing is persisted here — the
  // provider owns the checkout session) — 200 with a redirect URL, same
  // shape as /billing/portal.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiDefaultResponse({ status: StatusCodes.OK, type: CheckoutResponseDto })
  @Serialize(CheckoutResponseDto)
  @HttpCode(StatusCodes.OK)
  @Post('checkout')
  public checkout(
    @CurrentUserId() userId: string,
    @Body() dto: CreateCheckoutDto,
  ): Promise<CheckoutSessionInterface> {
    return this.billingService.createCheckoutSession(userId, dto.planId);
  }

  @ApiDefaultResponse({ status: StatusCodes.OK, type: CheckoutResponseDto })
  @Serialize(CheckoutResponseDto)
  @HttpCode(StatusCodes.OK)
  @Post('portal')
  public async portal(@CurrentUserId() userId: string): Promise<CheckoutSessionInterface> {
    const url: string = await this.billingService.createPortalSession(userId);

    return { url };
  }

  @ApiDefaultResponse({ status: StatusCodes.OK, type: SubscriptionResponseDto })
  @Serialize(SubscriptionResponseDto)
  @Get('subscription')
  public getSubscription(@CurrentUserId() userId: string): Promise<SubscriptionInterface> {
    return this.billingService.getCurrentSubscription(userId);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiDefaultResponse({ status: StatusCodes.OK, type: SubscriptionResponseDto })
  @Serialize(SubscriptionResponseDto)
  @HttpCode(StatusCodes.OK)
  @Post('cancel')
  public cancel(@CurrentUserId() userId: string): Promise<SubscriptionInterface> {
    return this.billingService.cancelSubscription(userId);
  }

  // Own transactions only — scoped by the caller's userId, no filters (see
  // TransactionAdminController for the filtered admin view).
  @ApiDefaultResponse({ status: StatusCodes.OK, type: TransactionListResponseDto })
  @Serialize(TransactionListResponseDto)
  @Get('transactions')
  public findMyTransactions(
    @CurrentUserId() userId: string,
    @Query() query: TransactionsQueryDto,
  ): Promise<TransactionListInterface> {
    return this.transactionService.findManyForUser(userId, {
      cursor: query.cursor,
      limit: query.limit,
    });
  }
}
