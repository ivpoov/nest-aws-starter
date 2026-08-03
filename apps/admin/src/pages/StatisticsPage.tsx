import { StatisticsMetricEnum } from '@nest-aws-starter/shared';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { AuthMethodBreakdown } from '../components/Statistics/AuthMethodBreakdown';
import { KpiTiles } from '../components/Statistics/KpiTiles';
import { RegistrationsChart } from '../components/Statistics/RegistrationsChart';
import { UsersByStatusBreakdown } from '../components/Statistics/UsersByStatusBreakdown';
import { useStatisticsOverview } from '../hooks/statistics/useStatisticsOverview';
import { useStatisticsSeries } from '../hooks/statistics/useStatisticsSeries';

export function StatisticsPage(): ReactElement {
  const [days, setDays] = useState<number>(30);
  const overview = useStatisticsOverview();
  const series = useStatisticsSeries(StatisticsMetricEnum.REGISTRATIONS, days);

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <KpiTiles
        totals={overview.overview?.totals ?? null}
        isLoading={overview.isLoading}
        error={overview.error}
        onRetry={overview.reload}
      />
      <RegistrationsChart
        points={series.points}
        isLoading={series.isLoading}
        error={series.error}
        days={days}
        onDaysChange={setDays}
        onRetry={series.reload}
      />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <AuthMethodBreakdown
          items={overview.overview?.authMethodDistribution ?? []}
          isLoading={overview.isLoading}
          error={overview.error}
          onRetry={overview.reload}
        />
        <UsersByStatusBreakdown
          items={overview.overview?.usersByStatus ?? []}
          isLoading={overview.isLoading}
          error={overview.error}
          onRetry={overview.reload}
        />
      </div>
    </div>
  );
}
