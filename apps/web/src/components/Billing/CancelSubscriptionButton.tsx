import type { ReactElement } from 'react';
import { useState } from 'react';
import { Button } from '../ui/Button';

interface CancelSubscriptionButtonPropsInterface {
  readonly isPending: boolean;
  readonly onConfirm: () => void;
}

export function CancelSubscriptionButton({
  isPending,
  onConfirm,
}: CancelSubscriptionButtonPropsInterface): ReactElement {
  const [isConfirming, setIsConfirming] = useState<boolean>(false);

  if (!isConfirming) {
    return (
      <Button variant="danger" onClick={(): void => setIsConfirming(true)}>
        Cancel subscription
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-content-muted">Cancel at period end?</span>
      <Button variant="danger" isDisabled={isPending} onClick={onConfirm}>
        {isPending ? 'Canceling…' : 'Confirm cancel'}
      </Button>
      <Button variant="ghost" isDisabled={isPending} onClick={(): void => setIsConfirming(false)}>
        Never mind
      </Button>
    </div>
  );
}
