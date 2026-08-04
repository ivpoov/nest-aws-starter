import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as billingApi from '../apis/billing';
import { useBillingSubscription } from '../hooks/billing/useBillingSubscription';

vi.mock('../apis/billing');

const subscription = {
  id: 'sub-1',
  planId: 'plan-1',
  planName: 'Pro',
  amountCents: 1900,
  currency: 'USD',
  status: 'ACTIVE',
  currentPeriodEndsAt: '2026-09-04T12:00:00.000Z',
  canceledAt: null,
};

describe('useBillingSubscription', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      value: { href: 'http://localhost/settings/billing' },
      writable: true,
    });
  });

  it('loads the current subscription on mount', async () => {
    vi.mocked(billingApi.fetchCurrentSubscription).mockResolvedValue(subscription as never);

    const { result } = renderHook(() => useBillingSubscription());

    await waitFor((): void => expect(result.current.isLoading).toBe(false));

    expect(result.current.subscription).toEqual(subscription);
    expect(result.current.isNotFound).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('treats PAYMENT_NO_SUBSCRIPTION as the empty state, not a surfaced error', async () => {
    vi.mocked(billingApi.fetchCurrentSubscription).mockRejectedValue({
      statusCode: 404,
      code: 'PAYMENT_NO_SUBSCRIPTION',
      details: 'You do not have an active subscription',
    });

    const { result } = renderHook(() => useBillingSubscription());

    await waitFor((): void => expect(result.current.isLoading).toBe(false));

    expect(result.current.subscription).toBeNull();
    expect(result.current.isNotFound).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('surfaces an unrelated error normally', async () => {
    vi.mocked(billingApi.fetchCurrentSubscription).mockRejectedValue({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      details: 'boom',
    });

    const { result } = renderHook(() => useBillingSubscription());

    await waitFor((): void => expect(result.current.isLoading).toBe(false));

    expect(result.current.isNotFound).toBe(false);
    expect(result.current.error?.code).toBe('INTERNAL_ERROR');
  });

  it('cancels the subscription and stores the updated row', async () => {
    vi.mocked(billingApi.fetchCurrentSubscription).mockResolvedValue(subscription as never);
    const canceled = {
      ...subscription,
      status: 'CANCELED',
      canceledAt: '2026-08-04T00:00:00.000Z',
    };
    vi.mocked(billingApi.cancelSubscription).mockResolvedValue(canceled as never);

    const { result } = renderHook(() => useBillingSubscription());

    await waitFor((): void => expect(result.current.isLoading).toBe(false));

    await act(async (): Promise<void> => {
      await result.current.cancel();
    });

    expect(result.current.subscription).toEqual(canceled);
    expect(result.current.cancelError).toBeNull();
  });

  it('surfaces a coded error from a failed cancel without losing the subscription', async () => {
    vi.mocked(billingApi.fetchCurrentSubscription).mockResolvedValue(subscription as never);
    vi.mocked(billingApi.cancelSubscription).mockRejectedValue({
      statusCode: 404,
      code: 'PAYMENT_NO_SUBSCRIPTION',
      details: 'You do not have an active subscription',
    });

    const { result } = renderHook(() => useBillingSubscription());

    await waitFor((): void => expect(result.current.isLoading).toBe(false));

    await act(async (): Promise<void> => {
      await result.current.cancel();
    });

    expect(result.current.cancelError?.code).toBe('PAYMENT_NO_SUBSCRIPTION');
    expect(result.current.subscription).toEqual(subscription);
  });

  it('opens the billing portal by redirecting to the returned url', async () => {
    vi.mocked(billingApi.fetchCurrentSubscription).mockResolvedValue(subscription as never);
    vi.mocked(billingApi.createPortalSession).mockResolvedValue({
      url: 'https://billing.example.com/portal/session',
    });

    const { result } = renderHook(() => useBillingSubscription());

    await waitFor((): void => expect(result.current.isLoading).toBe(false));

    await act(async (): Promise<void> => {
      await result.current.openPortal();
    });

    expect(window.location.href).toBe('https://billing.example.com/portal/session');
  });

  it('surfaces PAYMENT_PORTAL_UNAVAILABLE inline', async () => {
    vi.mocked(billingApi.fetchCurrentSubscription).mockResolvedValue(subscription as never);
    vi.mocked(billingApi.createPortalSession).mockRejectedValue({
      statusCode: 400,
      code: 'PAYMENT_PORTAL_UNAVAILABLE',
      details: 'The billing portal is not available for this subscription yet',
    });

    const { result } = renderHook(() => useBillingSubscription());

    await waitFor((): void => expect(result.current.isLoading).toBe(false));

    await act(async (): Promise<void> => {
      await result.current.openPortal();
    });

    expect(result.current.portalError?.code).toBe('PAYMENT_PORTAL_UNAVAILABLE');
  });
});
