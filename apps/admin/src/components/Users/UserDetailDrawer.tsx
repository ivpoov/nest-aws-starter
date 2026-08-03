import { UserRoleEnum, UserStatusEnum } from '@nest-aws-starter/shared';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { useUserActivities } from '../../hooks/activities/useUserActivities';
import { useAdminUserDetail } from '../../hooks/users/useAdminUserDetail';
import type { DrawerTabType } from '../../types/drawer-tab.type';
import { ActivityList } from '../Activities/ActivityList';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Loader } from '../ui/Loader';
import { UserActions } from './UserActions';

interface UserDetailDrawerPropsInterface {
  readonly userId: string | null;
  readonly onClose: () => void;
  readonly onUserChanged?: () => void;
}

function tabClassName(isActive: boolean): string {
  return isActive
    ? 'border-b-2 border-accent px-3 py-2 font-medium text-accent'
    : 'px-3 py-2 text-content-muted hover:text-content';
}

export function UserDetailDrawer({
  userId,
  onClose,
  onUserChanged,
}: UserDetailDrawerPropsInterface): ReactElement | null {
  const [activeTab, setActiveTab] = useState<DrawerTabType>('details');
  const {
    user,
    sessions,
    isLoading,
    error,
    forceLogout,
    updateStatus,
    isUpdatingStatus,
    loginAs,
    isLoggingIn,
  } = useAdminUserDetail(userId);
  const activity = useUserActivities(activeTab === 'activity' ? userId : null);

  if (!userId) return null;

  function handleDetailsTabClick(): void {
    setActiveTab('details');
  }

  function handleActivityTabClick(): void {
    setActiveTab('activity');
  }

  function handleToggleStatus(reason?: string): void {
    if (!user) return;

    const nextStatus: UserStatusEnum =
      user.status === UserStatusEnum.BLOCKED ? UserStatusEnum.ACTIVE : UserStatusEnum.BLOCKED;

    void updateStatus(nextStatus, reason).then(onUserChanged);
  }

  return (
    <div className="fixed inset-y-0 right-0 z-20 w-full max-w-md overflow-y-auto border-l border-edge bg-surface-raised p-6 shadow-xl">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold">User detail</h2>
        <button
          type="button"
          onClick={onClose}
          className="text-sm text-content-muted hover:text-content"
        >
          Close
        </button>
      </div>
      <div className="mb-4 flex gap-2 border-b border-edge text-sm">
        <button
          type="button"
          onClick={handleDetailsTabClick}
          className={tabClassName(activeTab === 'details')}
        >
          Details
        </button>
        <button
          type="button"
          onClick={handleActivityTabClick}
          className={tabClassName(activeTab === 'activity')}
        >
          Activity
        </button>
      </div>
      {activeTab === 'activity' ? (
        <ActivityList
          activities={activity.activities}
          isLoading={activity.isLoading}
          error={activity.error}
          hasMore={activity.hasMore}
          onLoadMore={activity.loadMore}
          emptyMessage="No activity for this user"
        />
      ) : isLoading || !user ? (
        <Loader />
      ) : (
        <div className="flex flex-col gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-base font-medium">{user.displayName}</span>
            <Badge
              label={user.role}
              tone={user.role === UserRoleEnum.ADMIN ? 'positive' : 'neutral'}
            />
            <Badge
              label={user.status}
              tone={user.status === UserStatusEnum.BLOCKED ? 'negative' : 'neutral'}
            />
          </div>
          <p className="text-content-muted">{user.email ?? 'No email'}</p>
          <div>
            <p className="mb-1 font-medium">Sign-in methods</p>
            <div className="flex gap-2">
              {user.methodTypes.map((type) => (
                <Badge key={type} label={type} />
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 font-medium">Active sessions: {sessions.length}</p>
            <ul className="flex flex-col gap-1 text-content-muted">
              {sessions.map((session) => (
                <li key={session.id} className="flex items-center gap-2">
                  <span>
                    {session.device} · {session.ip}
                  </span>
                  {session.isImpersonated ? <Badge label="Impersonated" tone="negative" /> : null}
                </li>
              ))}
            </ul>
          </div>
          {error ? <p className="text-danger">{error.details}</p> : null}
          <UserActions
            status={user.status}
            isUpdatingStatus={isUpdatingStatus}
            isLoggingIn={isLoggingIn}
            onToggleStatus={handleToggleStatus}
            onLoginAs={(): void => void loginAs()}
          />
          <Button variant="danger" onClick={(): void => void forceLogout()}>
            Log out all sessions
          </Button>
        </div>
      )}
    </div>
  );
}
