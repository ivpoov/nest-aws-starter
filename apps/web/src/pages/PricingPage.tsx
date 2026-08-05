import type { PublicPlanResponseInterface } from '@nest-aws-starter/shared';
import type { ReactElement } from 'react';
import { PlanCard } from '../components/Billing/PlanCard';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import { Loader } from '../components/ui/Loader';
import { PAYMENT_PROVIDER_NOT_ENABLED_CODE } from '../constants/billing.constants';
import { useCheckout } from '../hooks/billing/useCheckout';
import { usePublicPlans } from '../hooks/billing/usePublicPlans';
import { useAuthStore } from '../stores/auth.store';

export function PricingPage(): ReactElement {
  const { plans, isLoading, error } = usePublicPlans();
  const { pendingPlanId, error: checkoutError, startCheckout } = useCheckout();
  const isAuthenticated: boolean = useAuthStore((state) => state.accessToken !== null);
  const isPaymentsDisabled: boolean = checkoutError?.code === PAYMENT_PROVIDER_NOT_ENABLED_CODE;

  if (isLoading) return <Loader />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <div className="mx-auto mt-16 max-w-4xl px-6">
      <h1 className="mb-8 text-center text-2xl font-semibold">Pricing</h1>
      {isPaymentsDisabled ? (
        <p className="mb-6 text-center text-sm text-content-muted">
          Payments aren&apos;t configured on this environment yet — check back soon.
        </p>
      ) : null}
      {checkoutError && !isPaymentsDisabled ? (
        <p className="mb-6 text-center text-sm text-danger">{checkoutError.details}</p>
      ) : null}
      {plans.length === 0 ? (
        <EmptyState message="No plans are available right now." />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan: PublicPlanResponseInterface) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isAuthenticated={isAuthenticated}
              isPending={pendingPlanId === plan.id}
              onSubscribe={(planId): void => void startCheckout(planId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
