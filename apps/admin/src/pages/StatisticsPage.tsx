import { StatisticsMetricEnum } from '@nest-aws-starter/shared';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { AuthMethodBreakdown } from '../components/Statistics/AuthMethodBreakdown';
import { KpiTiles } from '../components/Statistics/KpiTiles';
import { RegistrationsChart } from '../components/Statistics/RegistrationsChart';
import { RevenueByPlanBreakdown } from '../components/Statistics/RevenueByPlanBreakdown';
import { RevenueChart } from '../components/Statistics/RevenueChart';
import { UsersByStatusBreakdown } from '../components/Statistics/UsersByStatusBreakdown';
import { useStatisticsOverview } from '../hooks/statistics/useStatisticsOverview';
import { useStatisticsSeries } from '../hooks/statistics/useStatisticsSeries';

export function StatisticsPage(): ReactElement {
  const [registrationDays, setRegistrationDays] = useState<number>(30);
  const [revenueDays, setRevenueDays] = useState<number>(30);
  const overview = useStatisticsOverview();
  const registrations = useStatisticsSeries(StatisticsMetricEnum.REGISTRATIONS, registrationDays);
  const revenue = useStatisticsSeries(StatisticsMetricEnum.REVENUE, revenueDays);

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <KpiTiles
        totals={overview.overview?.totals ?? null}
        isLoading={overview.isLoading}
        error={overview.error}
        onRetry={overview.reload}
      />
      <RegistrationsChart
        points={registrations.points}
        isLoading={registrations.isLoading}
        error={registrations.error}
        days={registrationDays}
        onDaysChange={setRegistrationDays}
        onRetry={registrations.reload}
      />
      <RevenueChart
        points={revenue.points}
        isLoading={revenue.isLoading}
        error={revenue.error}
        days={revenueDays}
        onDaysChange={setRevenueDays}
        onRetry={revenue.reload}
        isAvailable={overview.overview?.totals.revenue !== null}
      />
      <RevenueByPlanBreakdown
        items={overview.overview?.revenueByPlan ?? []}
        isLoading={overview.isLoading}
        error={overview.error}
        onRetry={overview.reload}
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
