import { UserRoleEnum, UserStatusEnum } from '@nest-aws-starter/shared';
import type { ReactElement } from 'react';
import { useAdminUserDetail } from '../../hooks/users/useAdminUserDetail';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Loader } from '../ui/Loader';

interface UserDetailDrawerPropsInterface {
  readonly userId: string | null;
  readonly onClose: () => void;
}

export function UserDetailDrawer({
  userId,
  onClose,
}: UserDetailDrawerPropsInterface): ReactElement | null {
  const { user, sessions, isLoading, error, forceLogout } = useAdminUserDetail(userId);

  if (!userId) return null;

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
      {isLoading || !user ? (
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
                <li key={session.id}>
                  {session.device} · {session.ip}
                </li>
              ))}
            </ul>
          </div>
          {error ? <p className="text-danger">{error.details}</p> : null}
          <Button variant="danger" onClick={(): void => void forceLogout()}>
            Log out all sessions
          </Button>
        </div>
      )}
    </div>
  );
}
