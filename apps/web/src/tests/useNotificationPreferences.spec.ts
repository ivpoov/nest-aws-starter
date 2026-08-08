import type { NotificationPreferenceResponseInterface } from '@nest-aws-starter/shared';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import * as notificationsApi from '../apis/notifications';
import { useNotificationPreferences } from '../hooks/notifications/useNotificationPreferences';

vi.mock('../apis/notifications');

const IN_APP_ROW: NotificationPreferenceResponseInterface = {
  type: 'PASSWORD_CHANGED' as NotificationPreferenceResponseInterface['type'],
  channel: 'IN_APP' as NotificationPreferenceResponseInterface['channel'],
  enabled: true,
  isEditable: false,
};

const EMAIL_ROW: NotificationPreferenceResponseInterface = {
  type: 'PASSWORD_CHANGED' as NotificationPreferenceResponseInterface['type'],
  channel: 'EMAIL' as NotificationPreferenceResponseInterface['channel'],
  enabled: true,
  isEditable: true,
};

describe('useNotificationPreferences', () => {
  it('loads the matrix on mount', async () => {
    vi.mocked(notificationsApi.fetchNotificationPreferences).mockResolvedValue({
      preferences: [IN_APP_ROW, EMAIL_ROW],
    });

    const { result } = renderHook(() => useNotificationPreferences());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.preferences).toHaveLength(2);
  });

  it('optimistically applies a toggle and keeps it on success', async () => {
    vi.mocked(notificationsApi.fetchNotificationPreferences).mockResolvedValue({
      preferences: [IN_APP_ROW, EMAIL_ROW],
    });
    vi.mocked(notificationsApi.updateNotificationPreferences).mockResolvedValue(undefined);

    const { result } = renderHook(() => useNotificationPreferences());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.toggle(EMAIL_ROW.type, EMAIL_ROW.channel, false);
    });

    expect(notificationsApi.updateNotificationPreferences).toHaveBeenCalledWith({
      preferences: [{ type: EMAIL_ROW.type, channel: EMAIL_ROW.channel, enabled: false }],
    });
    const updated = result.current.preferences.find(
      (preference) => preference.channel === EMAIL_ROW.channel,
    );

    expect(updated?.enabled).toBe(false);
    expect(result.current.pendingKey).toBeNull();
  });

  it('reverts the toggle when the PUT fails', async () => {
    vi.mocked(notificationsApi.fetchNotificationPreferences).mockResolvedValue({
      preferences: [IN_APP_ROW, EMAIL_ROW],
    });
    vi.mocked(notificationsApi.updateNotificationPreferences).mockRejectedValue({
      statusCode: 400,
      code: 'NOTIFICATION_PREFERENCE_TYPE_INVALID',
      details: 'invalid',
    });

    const { result } = renderHook(() => useNotificationPreferences());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.toggle(EMAIL_ROW.type, EMAIL_ROW.channel, false);
    });

    const updated = result.current.preferences.find(
      (preference) => preference.channel === EMAIL_ROW.channel,
    );

    expect(updated?.enabled).toBe(true);
    expect(result.current.error?.code).toBe('NOTIFICATION_PREFERENCE_TYPE_INVALID');
  });
});
