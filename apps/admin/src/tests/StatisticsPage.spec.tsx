import { StatisticsMetricEnum } from '@nest-aws-starter/shared';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as statisticsApi from '../apis/statistics';
import { StatisticsPage } from '../pages/StatisticsPage';

vi.mock('../apis/statistics');

const OVERVIEW: Record<string, unknown> = {
  totals: { users: 42, activeSessions: 7, onlineNow: 3, newToday: 5, revenue: null },
  usersByStatus: [
    { key: 'ACTIVE', count: 40 },
    { key: 'BLOCKED', count: 2 },
  ],
  authMethodDistribution: [
    { key: 'EMAIL', count: 30 },
    { key: 'GOOGLE', count: 12 },
  ],
};

describe('StatisticsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(statisticsApi.fetchStatisticsSeries).mockResolvedValue({
      metric: StatisticsMetricEnum.REGISTRATIONS,
      days: 30,
      points: [{ date: '2026-08-01', value: 4 }],
    } as never);
  });

  it('renders KPI tile values once the overview loads', async () => {
    vi.mocked(statisticsApi.fetchStatisticsOverview).mockResolvedValue(OVERVIEW as never);

    render(<StatisticsPage />);

    expect(await screen.findByText('42')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
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

  it('refetches the series with the new day count when the switcher is clicked', async () => {
    vi.mocked(statisticsApi.fetchStatisticsOverview).mockResolvedValue(OVERVIEW as never);

    render(<StatisticsPage />);

    await waitFor((): void => {
      expect(statisticsApi.fetchStatisticsSeries).toHaveBeenCalledWith(
        StatisticsMetricEnum.REGISTRATIONS,
        30,
      );
    });

    fireEvent.click(await screen.findByText('7d'));

    await waitFor((): void => {
      expect(statisticsApi.fetchStatisticsSeries).toHaveBeenLastCalledWith(
        StatisticsMetricEnum.REGISTRATIONS,
        7,
      );
    });
  });
});
