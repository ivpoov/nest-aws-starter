import { ApiDefaultResponse } from '@decorators/api-default-response.decorator.js';
import { CurrentUserId } from '@decorators/current-user-id.decorator.js';
import { Serialize } from '@decorators/serialize.decorator.js';
import { CreateCheckoutDto } from '@modules/payment/dtos/create-checkout.dto.js';
import { CheckoutResponseDto } from '@modules/payment/dtos/responses/checkout-response.dto.js';
import { SubscriptionResponseDto } from '@modules/payment/dtos/responses/subscription-response.dto.js';
import type { CheckoutSessionInterface } from '@modules/payment/interfaces/checkout-session.interface.js';
import type { SubscriptionInterface } from '@modules/payment/interfaces/subscription.interface.js';
import { BillingService } from '@modules/payment/services/billing.service.js';
import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { StatusCodes } from 'http-status-codes';

@ApiBearerAuth()
@ApiTags('Billing')
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

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
}
