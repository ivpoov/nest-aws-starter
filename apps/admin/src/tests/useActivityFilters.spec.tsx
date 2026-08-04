import { ActivityTypeEnum } from '@nest-aws-starter/shared';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useActivityFilters } from '../hooks/activities/useActivityFilters';

describe('useActivityFilters', () => {
  it('starts with empty filters and no selected user', () => {
    const { result } = renderHook(() => useActivityFilters());

    expect(result.current.filters).toEqual({ userId: '', type: null, dateFrom: '', dateTo: '' });
    expect(result.current.selectedUserLabel).toBeNull();
  });

  it('toggles a type chip on', () => {
    const { result } = renderHook(() => useActivityFilters());

    act(() => {
      result.current.toggleType(ActivityTypeEnum.AUTH_LOGIN);
    });

    expect(result.current.filters.type).toBe(ActivityTypeEnum.AUTH_LOGIN);
  });

  it('toggles the same type chip back off', () => {
    const { result } = renderHook(() => useActivityFilters());

    act(() => {
      result.current.toggleType(ActivityTypeEnum.AUTH_LOGIN);
    });
    act(() => {
      result.current.toggleType(ActivityTypeEnum.AUTH_LOGIN);
    });

    expect(result.current.filters.type).toBeNull();
  });

  it('switches to a different type chip without needing to toggle off first', () => {
    const { result } = renderHook(() => useActivityFilters());

    act(() => {
      result.current.toggleType(ActivityTypeEnum.AUTH_LOGIN);
    });
    act(() => {
      result.current.toggleType(ActivityTypeEnum.AUTH_LOGOUT);
    });

    expect(result.current.filters.type).toBe(ActivityTypeEnum.AUTH_LOGOUT);
  });

  it('clears the type filter via clearType', () => {
    const { result } = renderHook(() => useActivityFilters());

    act(() => {
      result.current.toggleType(ActivityTypeEnum.AUTH_LOGIN);
    });
    act(() => {
      result.current.clearType();
    });

    expect(result.current.filters.type).toBeNull();
  });

  it('converts a from-date into a start-of-day ISO bound', () => {
    const { result } = renderHook(() => useActivityFilters());

    act(() => {
      result.current.setDateFrom('2026-08-01');
    });

    expect(result.current.filters.dateFrom).toBe('2026-08-01T00:00:00.000Z');
  });

  it('converts a to-date into an end-of-day ISO bound', () => {
    const { result } = renderHook(() => useActivityFilters());

    act(() => {
      result.current.setDateTo('2026-08-03');
    });

    expect(result.current.filters.dateTo).toBe('2026-08-03T23:59:59.000Z');
  });

  it('clears a date bound when the input is cleared', () => {
    const { result } = renderHook(() => useActivityFilters());

    act(() => {
      result.current.setDateFrom('2026-08-01');
    });
    act(() => {
      result.current.setDateFrom('');
    });

    expect(result.current.filters.dateFrom).toBe('');
  });

  it('sets the userId and label when a user is selected', () => {
    const { result } = renderHook(() => useActivityFilters());

    act(() => {
      result.current.selectUser('u-1', 'Jane Doe (jane@example.com)');
    });

    expect(result.current.filters.userId).toBe('u-1');
    expect(result.current.selectedUserLabel).toBe('Jane Doe (jane@example.com)');
  });

  it('clears the userId and label when the user selection is cleared', () => {
    const { result } = renderHook(() => useActivityFilters());

    act(() => {
      result.current.selectUser('u-1', 'Jane Doe');
    });
    act(() => {
      result.current.clearUser();
    });

    expect(result.current.filters.userId).toBe('');
    expect(result.current.selectedUserLabel).toBeNull();
  });
});
