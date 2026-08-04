import type { CurrentUserInterface } from '@interfaces/current-user.interface.js';
import { ForbiddenError } from '@modules/common/errors/forbidden.error.js';
import { REQUIRES_SUBSCRIPTION_METADATA_KEY } from '@modules/payment/constants/requires-subscription.constants.js';
import { RequiresSubscriptionGuard } from '@modules/payment/guards/requires-subscription.guard.js';
import { SubscriptionService } from '@modules/payment/services/subscription.service.js';
import { UserRoleEnum } from '@nest-aws-starter/shared';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';

function createGuard(requiresSubscription: boolean, hasActive: boolean): RequiresSubscriptionGuard {
  const reflector = {
    get: vi.fn((key: string) =>
      key === REQUIRES_SUBSCRIPTION_METADATA_KEY ? requiresSubscription : undefined,
    ),
  } as unknown as Reflector;
  const subscriptionService = {
    hasActiveSubscription: vi.fn().mockResolvedValue(hasActive),
  } as unknown as SubscriptionService;

  return new RequiresSubscriptionGuard(reflector, subscriptionService);
}

function createContext(user: CurrentUserInterface | undefined): ExecutionContext {
  return {
    getHandler: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

const user: CurrentUserInterface = { id: 'user-1', role: UserRoleEnum.USER, sessionId: 's1' };

describe('RequiresSubscriptionGuard', () => {
  it('allows through when the route has no @RequiresSubscription metadata', async () => {
    const guard = createGuard(false, false);

    await expect(guard.canActivate(createContext(user))).resolves.toBe(true);
  });

  it('allows through when the user has an active subscription', async () => {
    const guard = createGuard(true, true);

    await expect(guard.canActivate(createContext(user))).resolves.toBe(true);
  });

  it('throws a coded ForbiddenError when the user has no active subscription', async () => {
    const guard = createGuard(true, false);

    await expect(guard.canActivate(createContext(user))).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('throws a coded ForbiddenError when there is no authenticated user', async () => {
    const guard = createGuard(true, true);

    try {
      await guard.canActivate(createContext(undefined));
      expect.unreachable('should have thrown');
    } catch (caught) {
      expect(caught).toBeInstanceOf(ForbiddenError);
      expect((caught as ForbiddenError).args.code).toBe('PAYMENT_SUBSCRIPTION_REQUIRED');
    }
  });
});
