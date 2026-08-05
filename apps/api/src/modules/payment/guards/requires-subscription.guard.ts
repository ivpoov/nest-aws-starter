import type { CurrentUserInterface } from '@interfaces/current-user.interface.js';
import { ForbiddenError } from '@modules/common/errors/forbidden.error.js';
import { PAYMENT_SUBSCRIPTION_REQUIRED } from '@modules/payment/constants/payment-errors.constants.js';
import { REQUIRES_SUBSCRIPTION_METADATA_KEY } from '@modules/payment/constants/requires-subscription.constants.js';
import { SubscriptionService } from '@modules/payment/services/subscription.service.js';
import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';

@Injectable()
export class RequiresSubscriptionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const requires: boolean | undefined = this.reflector.get(
      REQUIRES_SUBSCRIPTION_METADATA_KEY,
      context.getHandler(),
    );

    if (!requires) return true;

    const request: FastifyRequest & { user?: CurrentUserInterface } = context
      .switchToHttp()
      .getRequest();

    if (!request.user) throw new ForbiddenError(PAYMENT_SUBSCRIPTION_REQUIRED);

    const hasActive: boolean = await this.subscriptionService.hasActiveSubscription(
      request.user.id,
    );

    if (!hasActive) throw new ForbiddenError(PAYMENT_SUBSCRIPTION_REQUIRED);

    return true;
  }
}
