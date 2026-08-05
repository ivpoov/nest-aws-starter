import type { NotificationChannelEnum, NotificationTypeEnum } from '@nest-aws-starter/shared';
import type { ReactElement } from 'react';
import { PreferencesGrid } from '../components/Notifications/PreferencesGrid';
import { Card } from '../components/ui/Card';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import { Loader } from '../components/ui/Loader';
import { useNotificationPreferences } from '../hooks/notifications/useNotificationPreferences';

export function NotificationPreferencesPage(): ReactElement {
  const { preferences, isLoading, error, pendingKey, toggle } = useNotificationPreferences();

  function handleToggle(
    type: NotificationTypeEnum,
    channel: NotificationChannelEnum,
    enabled: boolean,
  ): void {
    void toggle(type, channel, enabled);
  }

  if (isLoading && preferences.length === 0) return <Loader />;
  if (error && preferences.length === 0) return <ErrorMessage error={error} />;

  return (
    <Card title="Notification preferences">
      <p className="mb-4 text-sm text-content-muted">
        In-app notifications are always on. Choose which of these also send an email.
      </p>
      <PreferencesGrid preferences={preferences} pendingKey={pendingKey} onToggle={handleToggle} />
      {error ? (
        <div className="mt-4">
          <ErrorMessage error={error} />
        </div>
      ) : null}
    </Card>
  );
}
