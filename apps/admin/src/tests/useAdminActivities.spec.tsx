import { ActivityTypeEnum } from '@nest-aws-starter/shared';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as activitiesApi from '../apis/activities';
import { useAdminActivities } from '../hooks/activities/useAdminActivities';
import type { ActivityFiltersInterface } from '../interfaces/activity-filters.interface';

vi.mock('../apis/activities');

const EMPTY_FILTERS: ActivityFiltersInterface = {
  userId: '',
  type: null,
  dateFrom: '',
  dateTo: '',
};

function activity(id: string): Record<string, unknown> {
  return {
    id,
    userId: 'u-1',
    actorId: null,
    sessionId: null,
    type: ActivityTypeEnum.AUTH_LOGIN,
    meta: null,
    ip: '127.0.0.1',
    createdAt: '2026-08-01T00:00:00.000Z',
  };
}

describe('useAdminActivities', () => {
  beforeEach(() => {
    vi.mocked(activitiesApi.fetchAdminActivities).mockResolvedValue({
      items: [activity('a-1')],
      nextCursor: 'a-1',
    } as never);
  });

  it('loads the first page and reports more', async () => {
    const { result } = renderHook(() => useAdminActivities(EMPTY_FILTERS));

    await waitFor((): void => expect(result.current.isLoading).toBe(false));

    expect(result.current.activities).toHaveLength(1);
    expect(result.current.hasMore).toBe(true);
  });

  it('appends the next page through the cursor', async () => {
    const { result } = renderHook(() => useAdminActivities(EMPTY_FILTERS));

    await waitFor((): void => expect(result.current.isLoading).toBe(false));

    vi.mocked(activitiesApi.fetchAdminActivities).mockResolvedValue({
      items: [activity('a-2')],
      nextCursor: null,
    } as never);

    await act(async (): Promise<void> => {
      await result.current.loadMore();
    });

    expect(activitiesApi.fetchAdminActivities).toHaveBeenLastCalledWith(20, 'a-1', EMPTY_FILTERS);
    expect(result.current.activities.map((item): string => item.id)).toEqual(['a-1', 'a-2']);
    expect(result.current.hasMore).toBe(false);
  });

  it('surfaces the error when the request fails', async () => {
    vi.mocked(activitiesApi.fetchAdminActivities).mockRejectedValue({
      statusCode: 500,
      code: 'INTERNAL',
      details: 'Something broke',
    });

    const { result } = renderHook(() => useAdminActivities(EMPTY_FILTERS));

    await waitFor((): void => expect(result.current.isLoading).toBe(false));

    expect(result.current.error?.code).toBe('INTERNAL');
    expect(result.current.activities).toHaveLength(0);
  });

  it('restarts from a fresh page when the filters change', async () => {
    const { result, rerender } = renderHook(
      ({ filters }: { filters: ActivityFiltersInterface }) => useAdminActivities(filters),
      { initialProps: { filters: EMPTY_FILTERS } },
    );

    await waitFor((): void => expect(result.current.isLoading).toBe(false));

    const nextFilters: ActivityFiltersInterface = { ...EMPTY_FILTERS, userId: 'u-2' };

    rerender({ filters: nextFilters });

    await waitFor((): void => {
      expect(activitiesApi.fetchAdminActivities).toHaveBeenLastCalledWith(20, null, nextFilters);
    });
  });
});
