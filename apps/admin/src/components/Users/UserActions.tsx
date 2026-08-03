import { UserStatusEnum } from '@nest-aws-starter/shared';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { Button } from '../ui/Button';
import { ConfirmInline } from '../ui/ConfirmInline';

type PendingConfirmType = 'status' | 'login-as' | null;

interface UserActionsPropsInterface {
  readonly status: UserStatusEnum;
  readonly isUpdatingStatus: boolean;
  readonly isLoggingIn: boolean;
  readonly onToggleStatus: () => void;
  readonly onLoginAs: () => void;
}

export function UserActions({
  status,
  isUpdatingStatus,
  isLoggingIn,
  onToggleStatus,
  onLoginAs,
}: UserActionsPropsInterface): ReactElement {
  const [confirming, setConfirming] = useState<PendingConfirmType>(null);
  const isBlocked: boolean = status === UserStatusEnum.BLOCKED;

  function cancel(): void {
    setConfirming(null);
  }

  function confirmStatus(): void {
    setConfirming(null);
    onToggleStatus();
  }

  function confirmLoginAs(): void {
    setConfirming(null);
    onLoginAs();
  }

  if (confirming === 'status') {
    return (
      <ConfirmInline
        message={
          isBlocked ? 'Unblock this user?' : 'Block this user? Active sessions will be revoked.'
        }
        isPending={isUpdatingStatus}
        onConfirm={confirmStatus}
        onCancel={cancel}
      />
    );
  }

  if (confirming === 'login-as') {
    return (
      <ConfirmInline
        message="Open the web app signed in as this user, in a new tab?"
        isPending={isLoggingIn}
        onConfirm={confirmLoginAs}
        onCancel={cancel}
      />
    );
  }

  return (
    <div className="flex gap-2">
      <Button
        variant={isBlocked ? 'primary' : 'danger'}
        onClick={(): void => setConfirming('status')}
      >
        {isBlocked ? 'Unblock user' : 'Block user'}
      </Button>
      <Button variant="ghost" onClick={(): void => setConfirming('login-as')}>
        Log in as user
      </Button>
    </div>
  );
}
