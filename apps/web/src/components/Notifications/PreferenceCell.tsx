import type {
  NotificationChannelEnum,
  NotificationPreferenceResponseInterface,
  NotificationTypeEnum,
} from '@nest-aws-starter/shared';
import type { ReactElement } from 'react';
import { NOTIFICATION_CHANNEL_LABELS } from '../../constants/notification-channel-labels.constants';
import { NOTIFICATION_TYPE_LABELS } from '../../constants/notification-type-labels.constants';

interface PreferenceCellPropsInterface {
  readonly preference: NotificationPreferenceResponseInterface;
  readonly isPending: boolean;
  readonly onToggle: (
    type: NotificationTypeEnum,
    channel: NotificationChannelEnum,
    enabled: boolean,
  ) => void;
}

export function PreferenceCell({
  preference,
  isPending,
  onToggle,
}: PreferenceCellPropsInterface): ReactElement {
  const label: string = `${NOTIFICATION_TYPE_LABELS[preference.type]} — ${NOTIFICATION_CHANNEL_LABELS[preference.channel]}`;

  if (!preference.isEditable) {
    return (
      <span className="text-xs text-content-muted" title="Always on — cannot be disabled">
        Always on
      </span>
    );
  }

  function handleClick(): void {
    onToggle(preference.type, preference.channel, !preference.enabled);
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={preference.enabled}
      aria-label={label}
      disabled={isPending}
      onClick={handleClick}
      className={`h-6 w-11 rounded-full transition disabled:opacity-50 ${
        preference.enabled ? 'bg-accent' : 'bg-edge'
      }`}
    >
      <span
        className={`block size-5 rounded-full bg-surface-raised transition ${
          preference.enabled ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}
