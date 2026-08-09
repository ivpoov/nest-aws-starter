import { StatisticsMetricEnum } from '@nest-aws-starter/shared';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as statisticsApi from '../apis/statistics';
import { StatisticsPage } from '../pages/StatisticsPage';

vi.mock('../apis/statistics');

const OVERVIEW: Record<string, unknown> = {
  totals: {
    users: 42,
    activeSessions: 7,
    onlineNow: 3,
    newToday: 5,
    revenueCents: null,
    mrrCents: null,
  },
  usersByStatus: [
    { key: 'ACTIVE', count: 40 },
    { key: 'BLOCKED', count: 2 },
  ],
  authMethodDistribution: [
    { key: 'EMAIL', count: 30 },
    { key: 'GOOGLE', count: 12 },
  ],
  revenueByPlan: [],
};

// <module:payment>
// Payment present — revenue/mrr are real numbers, and RevenueChart's
// switcher is only rendered in this state (isAvailable derives from
// totals.revenueCents !== null, mirroring KpiTiles).
const OVERVIEW_WITH_REVENUE: Record<string, unknown> = {
  ...OVERVIEW,
  totals: {
    ...(OVERVIEW.totals as Record<string, unknown>),
    revenueCents: 12_500,
    mrrCents: 4_900,
  },
};
// </module:payment>

describe('StatisticsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(statisticsApi.fetchStatisticsSeries).mockImplementation((metric) =>
      Promise.resolve({
        metric,
        days: 30,
        points: [{ date: '2026-08-01', value: 4 }],
      } as never),
    );
  });

  it('renders KPI tile values once the overview loads', async () => {
    vi.mocked(statisticsApi.fetchStatisticsOverview).mockResolvedValue(OVERVIEW as never);

    render(<StatisticsPage />);

    expect(await screen.findByText('42')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    // Revenue and MRR tiles both render the null-fallback dash.
    expect(screen.getAllByText('—')).toHaveLength(2);
  });

  it('shows the error state when the overview request fails', async () => {
    vi.mocked(statisticsApi.fetchStatisticsOverview).mockRejectedValue({
      statusCode: 500,
      code: 'INTERNAL',
      details: 'Something broke',
    });

    render(<StatisticsPage />);

    expect(await screen.findAllByText('Something broke')).not.toHaveLength(0);
  });

  it('refetches the registrations series with the new day count when its switcher is clicked', async () => {
    vi.mocked(statisticsApi.fetchStatisticsOverview).mockResolvedValue(OVERVIEW as never);

    render(<StatisticsPage />);

    await waitFor((): void => {
      expect(statisticsApi.fetchStatisticsSeries).toHaveBeenCalledWith(
        StatisticsMetricEnum.REGISTRATIONS,
        30,
      );
    });

    // Both the registrations and revenue charts render a "7d"/"30d"/"90d"
    // switcher — the registrations one renders first.
    const switchers: HTMLElement[] = await screen.findAllByText('7d');

    fireEvent.click(switchers[0] as HTMLElement);

    await waitFor((): void => {
      expect(statisticsApi.fetchStatisticsSeries).toHaveBeenLastCalledWith(
        StatisticsMetricEnum.REGISTRATIONS,
        7,
      );
    });
  });

  // <module:payment>
  it('fetches and refetches the revenue series independently of the registrations series', async () => {
    vi.mocked(statisticsApi.fetchStatisticsOverview).mockResolvedValue(
      OVERVIEW_WITH_REVENUE as never,
    );

    render(<StatisticsPage />);

    await waitFor((): void => {
      expect(statisticsApi.fetchStatisticsSeries).toHaveBeenCalledWith(
        StatisticsMetricEnum.REVENUE,
        30,
      );
    });

    const switchers: HTMLElement[] = await screen.findAllByText('7d');

    expect(switchers).toHaveLength(2);

    fireEvent.click(switchers[1] as HTMLElement);

    await waitFor((): void => {
      expect(statisticsApi.fetchStatisticsSeries).toHaveBeenLastCalledWith(
        StatisticsMetricEnum.REVENUE,
        7,
      );
    });
  });

  it('shows the unavailable placeholder for the revenue chart instead of a chart when payment is absent', async () => {
    vi.mocked(statisticsApi.fetchStatisticsOverview).mockResolvedValue(OVERVIEW as never);

    render(<StatisticsPage />);

    expect(await screen.findByText('Revenue requires the payment module')).toBeInTheDocument();

    // Only the registrations chart's switcher renders — RevenueChart hides
    // its own switcher while unavailable.
    const switchers: HTMLElement[] = await screen.findAllByText('7d');

    expect(switchers).toHaveLength(1);
  });
  // </module:payment>
});
