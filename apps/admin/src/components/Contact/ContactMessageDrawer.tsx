import {
  type ContactMessageResponseInterface,
  ContactMessageStatusEnum,
} from '@nest-aws-starter/shared';
import type { ReactElement } from 'react';
import { useContactMessageStatus } from '../../hooks/contact/useContactMessageStatus';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

interface ContactMessageDrawerPropsInterface {
  readonly message: ContactMessageResponseInterface | null;
  readonly onClose: () => void;
  readonly onStatusChanged: () => void;
}

export function ContactMessageDrawer({
  message,
  onClose,
  onStatusChanged,
}: ContactMessageDrawerPropsInterface): ReactElement | null {
  const { updateStatus, isPending, error } = useContactMessageStatus();

  if (!message) return null;

  const isOpen: boolean = message.status === ContactMessageStatusEnum.OPEN;

  async function handleToggleStatus(): Promise<void> {
    if (!message) return;

    const nextStatus: ContactMessageStatusEnum = isOpen
      ? ContactMessageStatusEnum.RESOLVED
      : ContactMessageStatusEnum.OPEN;
    const updated: ContactMessageResponseInterface | null = await updateStatus(
      message.id,
      nextStatus,
    );

    if (updated) onStatusChanged();
  }

  return (
    <div className="fixed inset-y-0 right-0 z-20 w-full max-w-md overflow-y-auto border-l border-edge bg-surface-raised p-6 shadow-xl">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Message detail</h2>
        <button
          type="button"
          onClick={onClose}
          className="text-sm text-content-muted hover:text-content"
        >
          Close
        </button>
      </div>
      <div className="flex flex-col gap-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-base font-medium">{message.subject}</span>
          <Badge label={message.status} tone={isOpen ? 'positive' : 'neutral'} />
        </div>
        <p className="text-content-muted">
          {message.name} &lt;{message.email}&gt;
        </p>
        <p className="text-content-muted">{new Date(message.createdAt).toLocaleString()}</p>
        <p className="whitespace-pre-wrap">{message.body}</p>
        {error ? <p className="text-danger">{error.details}</p> : null}
        <Button onClick={(): void => void handleToggleStatus()} isDisabled={isPending}>
          {isPending ? 'Working…' : isOpen ? 'Resolve' : 'Reopen'}
        </Button>
      </div>
    </div>
  );
}
