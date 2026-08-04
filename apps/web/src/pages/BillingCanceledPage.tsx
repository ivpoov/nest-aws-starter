import type { ReactElement } from 'react';
import { Link } from 'react-router';
import { Card } from '../components/ui/Card';

export function BillingCanceledPage(): ReactElement {
  return (
    <div className="mx-auto mt-16 max-w-md">
      <Card title="Checkout canceled">
        <p className="text-sm text-content-muted">
          No charge was made. You can pick a plan whenever you&apos;re ready.
        </p>
        <div className="mt-4">
          <Link to="/pricing" className="text-sm text-accent hover:underline">
            Back to pricing
          </Link>
        </div>
      </Card>
    </div>
  );
}
