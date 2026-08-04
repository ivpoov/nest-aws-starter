import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as billingApi from '../apis/billing';
import { usePublicPlans } from '../hooks/billing/usePublicPlans';

vi.mock('../apis/billing');

const plan = {
  id: 'plan-1',
  name: 'Pro',
  description: 'Full access',
  amountCents: 1900,
  currency: 'USD',
  intervalDays: 30,
};

describe('usePublicPlans', () => {
  beforeEach(() => {
    vi.mocked(billingApi.fetchPublicPlans).mockResolvedValue({ items: [plan] } as never);
  });

  it('loads active plans on mount', async () => {
    const { result } = renderHook(() => usePublicPlans());

    await waitFor((): void => expect(result.current.isLoading).toBe(false));

    expect(result.current.plans).toEqual([plan]);
    expect(result.current.error).toBeNull();
  });

  it('surfaces a coded error when the fetch fails', async () => {
    vi.mocked(billingApi.fetchPublicPlans).mockRejectedValue({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      details: 'boom',
    });

    const { result } = renderHook(() => usePublicPlans());

    await waitFor((): void => expect(result.current.isLoading).toBe(false));

    expect(result.current.plans).toEqual([]);
    expect(result.current.error?.code).toBe('INTERNAL_ERROR');
  });
});
