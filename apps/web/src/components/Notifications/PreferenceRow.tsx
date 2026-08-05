import type {
  NotificationChannelEnum,
  NotificationPreferenceResponseInterface,
  NotificationTypeEnum,
} from '@nest-aws-starter/shared';
import type { ReactElement } from 'react';
import { NOTIFICATION_TYPE_LABELS } from '../../constants/notification-type-labels.constants';
import { buildPreferenceKey } from '../../hooks/notifications/useNotificationPreferences';
import { PreferenceCell } from './PreferenceCell';

interface PreferenceRowPropsInterface {
  readonly type: NotificationTypeEnum;
  readonly channels: NotificationChannelEnum[];
  readonly preferences: NotificationPreferenceResponseInterface[];
  readonly pendingKey: string | null;
  readonly onToggle: (
    type: NotificationTypeEnum,
    channel: NotificationChannelEnum,
    enabled: boolean,
  ) => void;
}

export function PreferenceRow({
  type,
  channels,
  preferences,
  pendingKey,
  onToggle,
}: PreferenceRowPropsInterface): ReactElement {
  return (
    <tr className="border-t border-edge">
      <td className="p-2">{NOTIFICATION_TYPE_LABELS[type]}</td>
      {channels.map((channel: NotificationChannelEnum) => {
        const preference: NotificationPreferenceResponseInterface | undefined = preferences.find(
          (item: NotificationPreferenceResponseInterface): boolean =>
            item.type === type && item.channel === channel,
        );

        return (
          <td key={channel} className="p-2 text-center">
            {preference ? (
              <PreferenceCell
                preference={preference}
                isPending={pendingKey === buildPreferenceKey(type, channel)}
                onToggle={onToggle}
              />
            ) : null}
          </td>
        );
      })}
    </tr>
  );
}
