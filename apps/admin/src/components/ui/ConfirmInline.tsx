import type { ReactElement } from 'react';
import { Button } from './Button';

interface ConfirmInlinePropsInterface {
  readonly message: string;
  readonly isPending: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export function ConfirmInline({
  message,
  isPending,
  onConfirm,
  onCancel,
}: ConfirmInlinePropsInterface): ReactElement {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-edge p-3 text-sm">
      <p>{message}</p>
      <div className="flex gap-2">
        <Button variant="danger" isDisabled={isPending} onClick={onConfirm}>
          {isPending ? 'Working…' : 'Confirm'}
        </Button>
        <Button variant="ghost" isDisabled={isPending} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
