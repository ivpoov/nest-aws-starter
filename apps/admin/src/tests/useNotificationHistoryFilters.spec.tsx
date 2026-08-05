import { NotificationAudienceEnum, NotificationTypeEnum } from '@nest-aws-starter/shared';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useNotificationHistoryFilters } from '../hooks/notifications/useNotificationHistoryFilters';

describe('useNotificationHistoryFilters', () => {
  it('starts with no type/audience filter applied', () => {
    const { result } = renderHook(() => useNotificationHistoryFilters());

    expect(result.current.filters).toEqual({ type: null, audience: null });
  });

  it('toggles a type chip on then back off', () => {
    const { result } = renderHook(() => useNotificationHistoryFilters());

    act(() => {
      result.current.toggleType(NotificationTypeEnum.WEBHOOK_FAILED);
    });
    expect(result.current.filters.type).toBe(NotificationTypeEnum.WEBHOOK_FAILED);

    act(() => {
      result.current.toggleType(NotificationTypeEnum.WEBHOOK_FAILED);
    });
    expect(result.current.filters.type).toBeNull();
  });

  it('switches to a different type chip without needing to toggle off first', () => {
    const { result } = renderHook(() => useNotificationHistoryFilters());

    act(() => {
      result.current.toggleType(NotificationTypeEnum.WEBHOOK_FAILED);
    });
    act(() => {
      result.current.toggleType(NotificationTypeEnum.SUSPICIOUS_LOGIN);
    });

    expect(result.current.filters.type).toBe(NotificationTypeEnum.SUSPICIOUS_LOGIN);
  });

  it('clears the type filter via clearType', () => {
    const { result } = renderHook(() => useNotificationHistoryFilters());

    act(() => {
      result.current.toggleType(NotificationTypeEnum.WEBHOOK_FAILED);
    });
    act(() => {
      result.current.clearType();
    });

    expect(result.current.filters.type).toBeNull();
  });

  it('toggles the audience filter independently of the type filter', () => {
    const { result } = renderHook(() => useNotificationHistoryFilters());

    act(() => {
      result.current.toggleType(NotificationTypeEnum.WEBHOOK_FAILED);
      result.current.toggleAudience(NotificationAudienceEnum.ADMIN);
    });

    expect(result.current.filters).toEqual({
      type: NotificationTypeEnum.WEBHOOK_FAILED,
      audience: NotificationAudienceEnum.ADMIN,
    });

    act(() => {
      result.current.clearAudience();
    });

    expect(result.current.filters).toEqual({
      type: NotificationTypeEnum.WEBHOOK_FAILED,
      audience: null,
    });
  });
});
