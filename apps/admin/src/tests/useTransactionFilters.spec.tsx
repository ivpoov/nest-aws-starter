import { TransactionStatusEnum } from '@nest-aws-starter/shared';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useTransactionFilters } from '../hooks/transactions/useTransactionFilters';

describe('useTransactionFilters', () => {
  it('starts with empty filters and no selected user', () => {
    const { result } = renderHook(() => useTransactionFilters());

    expect(result.current.filters).toEqual({
      userId: '',
      status: null,
      dateFrom: '',
      dateTo: '',
    });
    expect(result.current.selectedUserLabel).toBeNull();
  });

  it('toggles a status chip on', () => {
    const { result } = renderHook(() => useTransactionFilters());

    act(() => {
      result.current.toggleStatus(TransactionStatusEnum.SUCCEEDED);
    });

    expect(result.current.filters.status).toBe(TransactionStatusEnum.SUCCEEDED);
  });

  it('toggles the same status chip back off', () => {
    const { result } = renderHook(() => useTransactionFilters());

    act(() => {
      result.current.toggleStatus(TransactionStatusEnum.SUCCEEDED);
    });
    act(() => {
      result.current.toggleStatus(TransactionStatusEnum.SUCCEEDED);
    });

    expect(result.current.filters.status).toBeNull();
  });

  it('switches to a different status chip without needing to toggle off first', () => {
    const { result } = renderHook(() => useTransactionFilters());

    act(() => {
      result.current.toggleStatus(TransactionStatusEnum.SUCCEEDED);
    });
    act(() => {
      result.current.toggleStatus(TransactionStatusEnum.FAILED);
    });

    expect(result.current.filters.status).toBe(TransactionStatusEnum.FAILED);
  });

  it('clears the status filter via clearStatus', () => {
    const { result } = renderHook(() => useTransactionFilters());

    act(() => {
      result.current.toggleStatus(TransactionStatusEnum.REFUNDED);
    });
    act(() => {
      result.current.clearStatus();
    });

    expect(result.current.filters.status).toBeNull();
  });

  it('converts a from-date into a start-of-day ISO bound', () => {
    const { result } = renderHook(() => useTransactionFilters());

    act(() => {
      result.current.setDateFrom('2026-08-01');
    });

    expect(result.current.filters.dateFrom).toBe('2026-08-01T00:00:00.000Z');
  });

  it('converts a to-date into an end-of-day ISO bound', () => {
    const { result } = renderHook(() => useTransactionFilters());

    act(() => {
      result.current.setDateTo('2026-08-03');
    });

    expect(result.current.filters.dateTo).toBe('2026-08-03T23:59:59.000Z');
  });

  it('clears a date bound when the input is cleared', () => {
    const { result } = renderHook(() => useTransactionFilters());

    act(() => {
      result.current.setDateFrom('2026-08-01');
    });
    act(() => {
      result.current.setDateFrom('');
    });

    expect(result.current.filters.dateFrom).toBe('');
  });

  it('sets the userId and label when a user is selected, then resets both on clear', () => {
    const { result } = renderHook(() => useTransactionFilters());

    act(() => {
      result.current.selectUser('u-1', 'Jane Doe (jane@example.com)');
    });

    expect(result.current.filters.userId).toBe('u-1');
    expect(result.current.selectedUserLabel).toBe('Jane Doe (jane@example.com)');

    act(() => {
      result.current.clearUser();
    });

    expect(result.current.filters.userId).toBe('');
    expect(result.current.selectedUserLabel).toBeNull();
  });
});
