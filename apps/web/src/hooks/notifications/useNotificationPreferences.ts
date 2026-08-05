import type {
  ApiErrorInterface,
  NotificationChannelEnum,
  NotificationPreferenceResponseInterface,
  NotificationPreferencesResponseInterface,
  NotificationTypeEnum,
} from '@nest-aws-starter/shared';
import { useCallback, useEffect, useState } from 'react';
import {
  fetchNotificationPreferences,
  updateNotificationPreferences,
} from '../../apis/notifications';
import type { UseNotificationPreferencesResultInterface } from '../../interfaces/use-notification-preferences-result.interface';
import { toApiError } from '../../utils/toApiError';

export function useNotificationPreferences(): UseNotificationPreferencesResultInterface {
  const [preferences, setPreferences] = useState<NotificationPreferenceResponseInterface[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiErrorInterface | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const result: NotificationPreferencesResponseInterface = await fetchNotificationPreferences();

      setPreferences(result.preferences);
    } catch (caught) {
      setError(toApiError(caught));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const toggle = useCallback(
    async (
      type: NotificationTypeEnum,
      channel: NotificationChannelEnum,
      enabled: boolean,
    ): Promise<void> => {
      const previous: NotificationPreferenceResponseInterface[] = preferences;

      setError(null);
      setPendingKey(buildPreferenceKey(type, channel));
      setPreferences((current: NotificationPreferenceResponseInterface[]) =>
        setEnabled(current, type, channel, enabled),
      );

      try {
        await updateNotificationPreferences({ preferences: [{ type, channel, enabled }] });
      } catch (caught) {
        setPreferences(previous);
        setError(toApiError(caught));
      } finally {
        setPendingKey(null);
      }
    },
    [preferences],
  );

  useEffect(() => {
    void load();
  }, [load]);

  return { preferences, isLoading, error, pendingKey, toggle };
}

export function buildPreferenceKey(
  type: NotificationTypeEnum,
  channel: NotificationChannelEnum,
): string {
  return `${type}:${channel}`;
}

function setEnabled(
  preferences: NotificationPreferenceResponseInterface[],
  type: NotificationTypeEnum,
  channel: NotificationChannelEnum,
  enabled: boolean,
): NotificationPreferenceResponseInterface[] {
  return preferences.map((preference: NotificationPreferenceResponseInterface) =>
    preference.type === type && preference.channel === channel
      ? { ...preference, enabled }
      : preference,
  );
}
