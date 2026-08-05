import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as plansApi from '../apis/plans';
import { useAdminPlans } from '../hooks/plans/useAdminPlans';

vi.mock('../apis/plans');

function adminPlan(id: string): Record<string, unknown> {
  return {
    id,
    name: `Plan ${id}`,
    description: '',
    amountCents: 999,
    currency: 'USD',
    intervalDays: 30,
    providerRefs: {},
    isActive: true,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  };
}

describe('useAdminPlans', () => {
  beforeEach(() => {
    vi.mocked(plansApi.fetchAdminPlans).mockResolvedValue({
      items: [adminPlan('p-1')],
      nextCursor: 'p-1',
    } as never);
  });

  it('loads the first page and reports more', async () => {
    const { result } = renderHook(() => useAdminPlans());

    await waitFor((): void => expect(result.current.isLoading).toBe(false));

    expect(result.current.plans).toHaveLength(1);
    expect(result.current.hasMore).toBe(true);
  });

  it('appends the next page through the cursor', async () => {
    const { result } = renderHook(() => useAdminPlans());

    await waitFor((): void => expect(result.current.isLoading).toBe(false));

    vi.mocked(plansApi.fetchAdminPlans).mockResolvedValue({
      items: [adminPlan('p-2')],
      nextCursor: null,
    } as never);

    await act(async (): Promise<void> => {
      await result.current.loadMore();
    });

    expect(plansApi.fetchAdminPlans).toHaveBeenLastCalledWith(20, 'p-1');
    expect(result.current.plans.map((plan): string => plan.id)).toEqual(['p-1', 'p-2']);
    expect(result.current.hasMore).toBe(false);
  });

  it('reload refetches the first page, discarding any loaded-more pages', async () => {
    const { result } = renderHook(() => useAdminPlans());

    await waitFor((): void => expect(result.current.isLoading).toBe(false));

    vi.mocked(plansApi.fetchAdminPlans).mockResolvedValue({
      items: [adminPlan('p-3')],
      nextCursor: null,
    } as never);

    await act(async (): Promise<void> => {
      await result.current.reload();
    });

    expect(plansApi.fetchAdminPlans).toHaveBeenLastCalledWith(20, null);
    expect(result.current.plans.map((plan): string => plan.id)).toEqual(['p-3']);
  });

  it('surfaces an error when the fetch fails', async () => {
    vi.mocked(plansApi.fetchAdminPlans).mockRejectedValue({
      statusCode: 500,
      code: 'INTERNAL',
      details: 'boom',
      timestamp: '',
      path: '',
    });

    const { result } = renderHook(() => useAdminPlans());

    await waitFor((): void => expect(result.current.isLoading).toBe(false));

    expect(result.current.error?.code).toBe('INTERNAL');
  });
});
