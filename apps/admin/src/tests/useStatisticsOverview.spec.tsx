import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as statisticsApi from '../apis/statistics';
import { useStatisticsOverview } from '../hooks/statistics/useStatisticsOverview';

vi.mock('../apis/statistics');

const OVERVIEW: Record<string, unknown> = {
  totals: {
    users: 10,
    activeSessions: 3,
    onlineNow: 1,
    newToday: 2,
    revenue: null,
    mrrCents: null,
  },
  usersByStatus: [{ key: 'ACTIVE', count: 9 }],
  authMethodDistribution: [{ key: 'EMAIL', count: 10 }],
  revenueByPlan: [],
};

describe('useStatisticsOverview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads the overview on mount', async () => {
    vi.mocked(statisticsApi.fetchStatisticsOverview).mockResolvedValue(OVERVIEW as never);

    const { result } = renderHook(() => useStatisticsOverview());

    expect(result.current.isLoading).toBe(true);

    await waitFor((): void => expect(result.current.isLoading).toBe(false));

    expect(result.current.overview).toEqual(OVERVIEW);
    expect(result.current.error).toBeNull();
  });

  it('surfaces the error when the request fails', async () => {
    vi.mocked(statisticsApi.fetchStatisticsOverview).mockRejectedValue({
      statusCode: 500,
      code: 'INTERNAL',
      details: 'Something broke',
    });

    const { result } = renderHook(() => useStatisticsOverview());

    await waitFor((): void => expect(result.current.isLoading).toBe(false));

    expect(result.current.error?.code).toBe('INTERNAL');
    expect(result.current.overview).toBeNull();
  });
});
