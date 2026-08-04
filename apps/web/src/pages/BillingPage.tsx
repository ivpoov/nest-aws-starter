import { SubscriptionStatusEnum } from '@nest-aws-starter/shared';
import type { ReactElement } from 'react';
import { Link } from 'react-router';
import { CancelSubscriptionButton } from '../components/Billing/CancelSubscriptionButton';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import { Loader } from '../components/ui/Loader';
import { useBillingSubscription } from '../hooks/billing/useBillingSubscription';
import { formatMoney } from '../utils/formatMoney';

const STATUS_TONE: Record<SubscriptionStatusEnum, 'neutral' | 'positive' | 'negative'> = {
  [SubscriptionStatusEnum.ACTIVE]: 'positive',
  [SubscriptionStatusEnum.PAST_DUE]: 'negative',
  [SubscriptionStatusEnum.CANCELED]: 'neutral',
  [SubscriptionStatusEnum.EXPIRED]: 'negative',
};

export function BillingPage(): ReactElement {
  const {
    subscription,
    isLoading,
    isNotFound,
    error,
    isCanceling,
    cancelError,
    isOpeningPortal,
    portalError,
    cancel,
    openPortal,
  } = useBillingSubscription();

  if (isLoading) return <Loader />;
  if (error) return <ErrorMessage error={error} />;

  if (isNotFound || !subscription) {
    return (
      <Card title="Billing">
        <p className="text-sm text-content-muted">You don&apos;t have a subscription yet.</p>
        <div className="mt-4">
          <Link to="/pricing" className="text-sm text-accent hover:underline">
            View pricing
          </Link>
        </div>
      </Card>
    );
  }

  const isCanceled: boolean = subscription.status === SubscriptionStatusEnum.CANCELED;
  const periodEndLabel: string = new Date(subscription.currentPeriodEndsAt).toLocaleDateString();

  return (
    <Card title="Your subscription">
      <div className="flex flex-col gap-2 text-sm">
        <p>
          <span className="text-content-muted">Plan: </span>
          {subscription.planName} ({formatMoney(subscription.amountCents, subscription.currency)})
        </p>
        <p className="flex items-center gap-2">
          <span className="text-content-muted">Status:</span>
          <Badge label={subscription.status} tone={STATUS_TONE[subscription.status]} />
        </p>
        <p>
          <span className="text-content-muted">
            {isCanceled ? 'Access until: ' : 'Renews on: '}
          </span>
          {periodEndLabel}
        </p>
        {subscription.canceledAt ? (
          <p className="text-content-muted">
            Canceled on {new Date(subscription.canceledAt).toLocaleDateString()} — access continues
            until {periodEndLabel}.
          </p>
        ) : null}
      </div>
      {cancelError ? <p className="mt-3 text-sm text-danger">{cancelError.details}</p> : null}
      {portalError ? <p className="mt-3 text-sm text-danger">{portalError.details}</p> : null}
      <div className="mt-4 flex flex-wrap gap-3">
        {isCanceled ? null : (
          <CancelSubscriptionButton isPending={isCanceling} onConfirm={(): void => void cancel()} />
        )}
        <Button
          variant="ghost"
          isDisabled={isOpeningPortal}
          onClick={(): void => void openPortal()}
        >
          {isOpeningPortal ? 'Opening…' : 'Manage billing'}
        </Button>
      </div>
    </Card>
  );
}
