import type { PublicPlanResponseInterface } from '@nest-aws-starter/shared';
import type { ReactElement } from 'react';
import { Link } from 'react-router';
import { formatBillingInterval } from '../../utils/formatBillingInterval';
import { formatMoney } from '../../utils/formatMoney';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

interface PlanCardPropsInterface {
  readonly plan: PublicPlanResponseInterface;
  readonly isAuthenticated: boolean;
  readonly isPending: boolean;
  readonly onSubscribe: (planId: string) => void;
}

export function PlanCard({
  plan,
  isAuthenticated,
  isPending,
  onSubscribe,
}: PlanCardPropsInterface): ReactElement {
  return (
    <Card title={plan.name}>
      <div className="flex flex-col gap-3">
        <p className="text-2xl font-semibold">
          {formatMoney(plan.amountCents, plan.currency)}
          <span className="ml-1 text-sm font-normal text-content-muted">
            / {formatBillingInterval(plan.intervalDays).toLowerCase()}
          </span>
        </p>
        {plan.description ? <p className="text-sm text-content-muted">{plan.description}</p> : null}
        {isAuthenticated ? (
          <Button isDisabled={isPending} onClick={(): void => onSubscribe(plan.id)}>
            {isPending ? 'Redirecting…' : 'Subscribe'}
          </Button>
        ) : (
          <Link
            to="/register"
            className="rounded-lg bg-accent px-4 py-2 text-center text-sm font-medium text-accent-content transition hover:opacity-90"
          >
            Create an account to subscribe
          </Link>
        )}
      </div>
    </Card>
  );
}
