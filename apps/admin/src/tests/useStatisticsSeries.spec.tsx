import { StatisticsMetricEnum } from '@nest-aws-starter/shared';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as statisticsApi from '../apis/statistics';
import { useStatisticsSeries } from '../hooks/statistics/useStatisticsSeries';

vi.mock('../apis/statistics');

describe('useStatisticsSeries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(statisticsApi.fetchStatisticsSeries).mockResolvedValue({
      metric: StatisticsMetricEnum.REGISTRATIONS,
      days: 30,
      points: [{ date: '2026-08-01', value: 5 }],
    } as never);
  });

  it('loads points for the given metric and days', async () => {
    const { result } = renderHook(() =>
      useStatisticsSeries(StatisticsMetricEnum.REGISTRATIONS, 30),
    );

    await waitFor((): void => expect(result.current.isLoading).toBe(false));

    expect(statisticsApi.fetchStatisticsSeries).toHaveBeenCalledWith(
      StatisticsMetricEnum.REGISTRATIONS,
      30,
    );
    expect(result.current.points).toEqual([{ date: '2026-08-01', value: 5 }]);
  });

  it('reloads when the metric or days change', async () => {
    const { result, rerender } = renderHook(
      ({ metric, days }: { metric: StatisticsMetricEnum; days: number }) =>
        useStatisticsSeries(metric, days),
      { initialProps: { metric: StatisticsMetricEnum.REGISTRATIONS, days: 30 } },
    );

    await waitFor((): void => expect(result.current.isLoading).toBe(false));

    rerender({ metric: StatisticsMetricEnum.NEW_DEVICES, days: 7 });

    await waitFor((): void => {
      expect(statisticsApi.fetchStatisticsSeries).toHaveBeenLastCalledWith(
        StatisticsMetricEnum.NEW_DEVICES,
        7,
      );
    });
  });

  it('surfaces the error when the request fails', async () => {
    vi.mocked(statisticsApi.fetchStatisticsSeries).mockRejectedValue({
      statusCode: 500,
      code: 'INTERNAL',
      details: 'Something broke',
    });

    const { result } = renderHook(() =>
      useStatisticsSeries(StatisticsMetricEnum.REGISTRATIONS, 30),
    );

    await waitFor((): void => expect(result.current.isLoading).toBe(false));

    expect(result.current.error?.code).toBe('INTERNAL');
    expect(result.current.points).toEqual([]);
  });
});
