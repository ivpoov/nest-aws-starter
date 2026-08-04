import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as billingApi from '../apis/billing';
import { useCheckout } from '../hooks/billing/useCheckout';

vi.mock('../apis/billing');

describe('useCheckout', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      value: { href: 'http://localhost/pricing' },
      writable: true,
    });
  });

  it('redirects to the provider checkout url on success', async () => {
    vi.mocked(billingApi.createCheckoutSession).mockResolvedValue({
      url: 'https://checkout.example.com/session/cs_test_1',
    });

    const { result } = renderHook(() => useCheckout());

    await act(async (): Promise<void> => {
      await result.current.startCheckout('plan-1');
    });

    expect(billingApi.createCheckoutSession).toHaveBeenCalledWith({ planId: 'plan-1' });
    expect(window.location.href).toBe('https://checkout.example.com/session/cs_test_1');
  });

  it('tracks the pending plan id while the request is in flight', async () => {
    let resolveCheckout: (value: { url: string }) => void = () => {};
    vi.mocked(billingApi.createCheckoutSession).mockReturnValue(
      new Promise((resolve) => {
        resolveCheckout = resolve;
      }),
    );

    const { result } = renderHook(() => useCheckout());

    act(() => {
      void result.current.startCheckout('plan-2');
    });

    await waitFor((): void => expect(result.current.pendingPlanId).toBe('plan-2'));

    await act(async (): Promise<void> => {
      resolveCheckout({ url: 'https://checkout.example.com/session/cs_test_2' });
    });
  });

  it('surfaces the coded error and clears pending state on failure', async () => {
    vi.mocked(billingApi.createCheckoutSession).mockRejectedValue({
      statusCode: 400,
      code: 'PAYMENT_PROVIDER_NOT_ENABLED',
      details: 'No payment provider is enabled',
    });

    const { result } = renderHook(() => useCheckout());

    await act(async (): Promise<void> => {
      await result.current.startCheckout('plan-3');
    });

    expect(result.current.error?.code).toBe('PAYMENT_PROVIDER_NOT_ENABLED');
    expect(result.current.pendingPlanId).toBeNull();
  });
});
