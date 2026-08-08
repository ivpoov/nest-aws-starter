import {
  NotificationChannelEnum,
  type NotificationPreferenceResponseInterface,
  type NotificationTypeEnum,
} from '@nest-aws-starter/shared';
import type { ReactElement } from 'react';
import { NOTIFICATION_CHANNEL_LABELS } from '../../constants/notification-channel-labels.constants';
import { PreferenceRow } from './PreferenceRow';

interface PreferencesGridPropsInterface {
  readonly preferences: NotificationPreferenceResponseInterface[];
  readonly pendingKey: string | null;
  readonly onToggle: (
    type: NotificationTypeEnum,
    channel: NotificationChannelEnum,
    enabled: boolean,
  ) => void;
}

const CHANNELS: NotificationChannelEnum[] = Object.values(NotificationChannelEnum);

export function PreferencesGrid({
  preferences,
  pendingKey,
  onToggle,
}: PreferencesGridPropsInterface): ReactElement {
  const types: NotificationTypeEnum[] = uniqueTypesInOrder(preferences);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="p-2 text-left font-medium text-content-muted">Notification</th>
            {CHANNELS.map((channel: NotificationChannelEnum) => (
              <th key={channel} className="p-2 text-center font-medium text-content-muted">
                {NOTIFICATION_CHANNEL_LABELS[channel]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {types.map((type: NotificationTypeEnum) => (
            <PreferenceRow
              key={type}
              type={type}
              channels={CHANNELS}
              preferences={preferences}
              pendingKey={pendingKey}
              onToggle={onToggle}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function uniqueTypesInOrder(
  preferences: NotificationPreferenceResponseInterface[],
): NotificationTypeEnum[] {
  const seen = new Set<NotificationTypeEnum>();
  const result: NotificationTypeEnum[] = [];

  for (const preference of preferences) {
    if (!seen.has(preference.type)) {
      seen.add(preference.type);
      result.push(preference.type);
    }
  }

  return result;
}
