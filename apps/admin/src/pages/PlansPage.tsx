import type { AdminPlanResponseInterface } from '@nest-aws-starter/shared';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { PlanFormModal } from '../components/Plans/PlanFormModal';
import { PlanRowActions } from '../components/Plans/PlanRowActions';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import { Table } from '../components/ui/Table';
import { useAdminPlans } from '../hooks/plans/useAdminPlans';
import type { TableColumnInterface } from '../interfaces/table-column.interface';

function formatAmount(amountCents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(
      amountCents / 100,
    );
  } catch {
    // An admin can type a currency code Intl doesn't recognize before the
    // backend rejects it — fall back rather than crash the row.
    return `${(amountCents / 100).toFixed(2)} ${currency}`;
  }
}

export function PlansPage(): ReactElement {
  const { plans, hasMore, isLoading, error, loadMore, reload } = useAdminPlans();
  const [editingPlan, setEditingPlan] = useState<AdminPlanResponseInterface | null>(null);
  const [isCreating, setIsCreating] = useState<boolean>(false);

  const columns: Array<TableColumnInterface<AdminPlanResponseInterface>> = [
    { key: 'name', header: 'Name', render: (row): string => row.name },
    {
      key: 'amount',
      header: 'Amount',
      render: (row): string => formatAmount(row.amountCents, row.currency),
    },
    { key: 'interval', header: 'Interval', render: (row): string => `${row.intervalDays}d` },
    {
      key: 'active',
      header: 'Status',
      render: (row): ReactElement => (
        <Badge
          label={row.isActive ? 'ACTIVE' : 'INACTIVE'}
          tone={row.isActive ? 'positive' : 'neutral'}
        />
      ),
    },
    {
      key: 'provider',
      header: 'Stripe price',
      render: (row): ReactElement =>
        row.providerRefs.STRIPE ? (
          <Badge label="Linked" tone="positive" />
        ) : (
          <Badge label="Not set" tone="neutral" />
        ),
    },
    {
      key: 'actions',
      header: '',
      render: (row): ReactElement => (
        <PlanRowActions plan={row} onChanged={(): void => void reload()} />
      ),
    },
  ];

  if (error && plans.length === 0) return <ErrorMessage error={error} onRetry={reload} />;

  function handleModalSaved(): void {
    setIsCreating(false);
    setEditingPlan(null);
    void reload();
  }

  function handleModalClose(): void {
    setIsCreating(false);
    setEditingPlan(null);
  }

  return (
    <div className="flex max-w-5xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Plans</h1>
        <Button onClick={(): void => setIsCreating(true)}>New plan</Button>
      </div>
      <Table
        columns={columns}
        rows={plans}
        rowKey={(row): string => row.id}
        isLoading={isLoading}
        emptyMessage="No plans yet"
        onRowClick={setEditingPlan}
      />
      {hasMore ? (
        <div>
          <Button variant="ghost" onClick={(): void => void loadMore()}>
            Load more
          </Button>
        </div>
      ) : null}
      {isCreating ? (
        <PlanFormModal plan={null} onClose={handleModalClose} onSaved={handleModalSaved} />
      ) : null}
      {editingPlan ? (
        <PlanFormModal plan={editingPlan} onClose={handleModalClose} onSaved={handleModalSaved} />
      ) : null}
    </div>
  );
}
