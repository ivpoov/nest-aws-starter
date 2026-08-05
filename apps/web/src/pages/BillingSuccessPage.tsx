import type { ReactElement } from 'react';
import { Link } from 'react-router';
import { Card } from '../components/ui/Card';

export function BillingSuccessPage(): ReactElement {
  return (
    <div className="mx-auto mt-16 max-w-md">
      <Card title="Payment received">
        {/* Activation happens asynchronously via the provider's webhook —
            never claim the subscription is active from this return page. */}
        <p className="text-sm text-content-muted">
          Payment received — your subscription activates as soon as the provider confirms it. This
          usually takes just a few seconds.
        </p>
        <div className="mt-4">
          <Link to="/settings/billing" className="text-sm text-accent hover:underline">
            Go to billing settings
          </Link>
        </div>
      </Card>
    </div>
  );
}
