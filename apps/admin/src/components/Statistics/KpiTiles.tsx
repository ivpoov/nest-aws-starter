import type { ApiErrorInterface, StatisticsTotalsInterface } from '@nest-aws-starter/shared';
import type { ReactElement } from 'react';
import { STATISTICS_REPORTING_CURRENCY } from '../../constants/statistics.constants';
import { formatMoney } from '../../utils/formatMoney';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { ErrorMessage } from '../ui/ErrorMessage';
import { Loader } from '../ui/Loader';
import { StatTile } from './StatTile';

interface KpiTilesPropsInterface {
  readonly totals: StatisticsTotalsInterface | null;
  readonly isLoading: boolean;
  readonly error: ApiErrorInterface | null;
  readonly onRetry: () => void;
}

function renderTiles(totals: StatisticsTotalsInterface): ReactElement {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      <StatTile label="Users" value={totals.users.toLocaleString()} />
      <StatTile label="Active sessions" value={totals.activeSessions.toLocaleString()} />
      <StatTile label="Online now" value={totals.onlineNow.toLocaleString()} />
      <StatTile label="New today" value={totals.newToday.toLocaleString()} />
      {totals.revenue === null ? (
        <StatTile label="Revenue (30d)" value="—" hint="Requires the payment module" />
      ) : (
        <StatTile
          label="Revenue (30d)"
          value={formatMoney(totals.revenue, STATISTICS_REPORTING_CURRENCY)}
        />
      )}
      {totals.mrrCents === null ? (
        <StatTile label="MRR" value="—" hint="Requires the payment module" />
      ) : (
        <StatTile label="MRR" value={formatMoney(totals.mrrCents, STATISTICS_REPORTING_CURRENCY)} />
      )}
    </div>
  );
}

function renderBody(
  totals: StatisticsTotalsInterface | null,
  isLoading: boolean,
  error: ApiErrorInterface | null,
  onRetry: () => void,
): ReactElement {
  if (error && !totals) return <ErrorMessage error={error} onRetry={onRetry} />;
  if (isLoading && !totals) return <Loader />;
  if (!totals) return <EmptyState message="No statistics available" />;

  return (
    <div className="flex flex-col gap-3">
      {renderTiles(totals)}
      {error ? <p className="text-sm text-danger">{error.details}</p> : null}
    </div>
  );
}

export function KpiTiles({
  totals,
  isLoading,
  error,
  onRetry,
}: KpiTilesPropsInterface): ReactElement {
  return <Card title="Overview">{renderBody(totals, isLoading, error, onRetry)}</Card>;
}
