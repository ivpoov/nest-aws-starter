import type { AdminPlanResponseInterface } from '@nest-aws-starter/shared';
import type { MouseEvent, ReactElement, ReactNode } from 'react';
import { useState } from 'react';
import { usePlanMutations } from '../../hooks/plans/usePlanMutations';
import { Button } from '../ui/Button';
import { ConfirmInline } from '../ui/ConfirmInline';

interface PlanRowActionsPropsInterface {
  readonly plan: AdminPlanResponseInterface;
  readonly onChanged: () => void;
}

type PendingConfirmType = 'activation' | 'delete' | null;

export function PlanRowActions({ plan, onChanged }: PlanRowActionsPropsInterface): ReactElement {
  const [confirming, setConfirming] = useState<PendingConfirmType>(null);
  const { isSaving, error, setActive, remove, clearError } = usePlanMutations();

  function cancel(): void {
    setConfirming(null);
    clearError();
  }

  async function confirmActivation(): Promise<void> {
    const succeeded: boolean = await setActive(plan.id, !plan.isActive);

    if (succeeded) {
      setConfirming(null);
      onChanged();
    }
  }

  async function confirmDelete(): Promise<void> {
    const succeeded: boolean = await remove(plan.id);

    if (succeeded) {
      setConfirming(null);
      onChanged();
    }
  }

  // Row actions live inside a clickable Table row (row click opens the edit
  // modal) — stop propagation so pressing an action button never also
  // triggers the row's onClick.
  function handleContainerClick(event: MouseEvent<HTMLDivElement>): void {
    event.stopPropagation();
  }

  function content(): ReactNode {
    if (confirming === 'activation') {
      return (
        <ConfirmInline
          message={plan.isActive ? 'Deactivate this plan?' : 'Activate this plan?'}
          isPending={isSaving}
          onConfirm={(): void => void confirmActivation()}
          onCancel={cancel}
        >
          {error ? <p className="text-danger">{error.details}</p> : null}
        </ConfirmInline>
      );
    }

    if (confirming === 'delete') {
      return (
        <ConfirmInline
          message="Delete this plan? This cannot be undone."
          isPending={isSaving}
          onConfirm={(): void => void confirmDelete()}
          onCancel={cancel}
        >
          {error ? <p className="text-danger">{error.details}</p> : null}
        </ConfirmInline>
      );
    }

    return (
      <div className="flex gap-2">
        <Button variant="ghost" onClick={(): void => setConfirming('activation')}>
          {plan.isActive ? 'Deactivate' : 'Activate'}
        </Button>
        <Button variant="danger" onClick={(): void => setConfirming('delete')}>
          Delete
        </Button>
      </div>
    );
  }

  // biome-ignore lint/a11y/noStaticElementInteractions: propagation guard only — the row's own onRowClick would otherwise fire when a real interactive child (Button) inside this cell is clicked; every actual action stays on a <button>.
  // biome-ignore lint/a11y/useKeyWithClickEvents: same — nothing here is itself a click target, so there's no keyboard equivalent to pair.
  return <div onClick={handleContainerClick}>{content()}</div>;
}
