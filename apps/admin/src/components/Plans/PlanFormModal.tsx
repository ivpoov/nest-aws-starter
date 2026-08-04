import type {
  AdminPlanResponseInterface,
  CreatePlanRequestInterface,
} from '@nest-aws-starter/shared';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { usePlanMutations } from '../../hooks/plans/usePlanMutations';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';

interface PlanFormModalPropsInterface {
  readonly plan: AdminPlanResponseInterface | null;
  readonly onClose: () => void;
  readonly onSaved: () => void;
}

const CURRENCY_PATTERN = /^[A-Z]{3}$/;

// Amount is entered in major units (e.g. dollars) and converted to the
// integer cents the API expects. Math.round guards against floating-point
// artifacts (e.g. 19.999 * 100 === 1999.8999...999).
function toAmountCents(majorUnits: string): number | null {
  const parsed: number = Number.parseFloat(majorUnits);

  if (!Number.isFinite(parsed) || parsed <= 0) return null;

  return Math.round(parsed * 100);
}

function toMajorUnitsInput(amountCents: number): string {
  return (amountCents / 100).toFixed(2);
}

export function PlanFormModal({
  plan,
  onClose,
  onSaved,
}: PlanFormModalPropsInterface): ReactElement {
  const isEditing: boolean = plan !== null;
  const [name, setName] = useState<string>(plan?.name ?? '');
  const [description, setDescription] = useState<string>(plan?.description ?? '');
  const [amount, setAmount] = useState<string>(plan ? toMajorUnitsInput(plan.amountCents) : '');
  const [currency, setCurrency] = useState<string>(plan?.currency ?? 'USD');
  const [intervalDays, setIntervalDays] = useState<string>(plan ? String(plan.intervalDays) : '30');
  const [stripeRef, setStripeRef] = useState<string>(plan?.providerRefs.STRIPE ?? '');
  const [validationError, setValidationError] = useState<string | null>(null);
  const { isSaving, error, create, update, clearError } = usePlanMutations();

  function validate(
    amountCents: number | null,
    intervalDaysValue: number,
    currencyCode: string,
  ): string | null {
    if (!name.trim()) return 'Name is required';
    if (amountCents === null) return 'Amount must be a positive number';
    if (!CURRENCY_PATTERN.test(currencyCode))
      return 'Currency must be a 3-letter ISO code (e.g. USD)';
    if (!Number.isInteger(intervalDaysValue) || intervalDaysValue <= 0) {
      return 'Interval days must be a positive whole number';
    }

    return null;
  }

  function buildPayload(): CreatePlanRequestInterface | null {
    const amountCents: number | null = toAmountCents(amount);
    const intervalDaysValue: number = Number.parseInt(intervalDays, 10);
    const currencyCode: string = currency.trim().toUpperCase();
    const validationMessage: string | null = validate(amountCents, intervalDaysValue, currencyCode);

    setValidationError(validationMessage);

    if (validationMessage || amountCents === null) return null;

    return {
      name: name.trim(),
      description: description.trim() || undefined,
      amountCents,
      currency: currencyCode,
      intervalDays: intervalDaysValue,
      providerRefs: stripeRef.trim() ? { STRIPE: stripeRef.trim() } : {},
    };
  }

  async function handleSubmit(): Promise<void> {
    clearError();

    const payload: CreatePlanRequestInterface | null = buildPayload();

    if (!payload) return;

    const saved = isEditing && plan ? await update(plan.id, payload) : await create(payload);

    if (saved) onSaved();
  }

  return (
    <Modal title={isEditing ? 'Edit plan' : 'New plan'} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <Input label="Name" value={name} onChange={setName} />
        <Input label="Description" value={description} onChange={setDescription} />
        <Input
          label="Amount (major units, e.g. 9.99)"
          value={amount}
          onChange={setAmount}
          type="number"
        />
        <Input label="Currency (ISO-4217, e.g. USD)" value={currency} onChange={setCurrency} />
        <Input
          label="Interval days"
          value={intervalDays}
          onChange={setIntervalDays}
          type="number"
        />
        <Input label="Stripe price id (optional)" value={stripeRef} onChange={setStripeRef} />
        {validationError ? <p className="text-sm text-danger">{validationError}</p> : null}
        {error ? <p className="text-sm text-danger">{error.details}</p> : null}
        <div className="mt-2 flex gap-2">
          <Button isDisabled={isSaving} onClick={(): void => void handleSubmit()}>
            {isSaving ? 'Saving…' : 'Save'}
          </Button>
          <Button variant="ghost" isDisabled={isSaving} onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}
