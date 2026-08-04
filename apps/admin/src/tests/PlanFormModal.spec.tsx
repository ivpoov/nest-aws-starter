import type { AdminPlanResponseInterface } from '@nest-aws-starter/shared';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as plansApi from '../apis/plans';
import { PlanFormModal } from '../components/Plans/PlanFormModal';

vi.mock('../apis/plans');

const EXISTING_PLAN: AdminPlanResponseInterface = {
  id: 'p-1',
  name: 'Starter Monthly',
  description: 'Monthly access',
  amountCents: 999,
  currency: 'USD',
  intervalDays: 30,
  providerRefs: {},
  isActive: true,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
};

describe('PlanFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('converts a major-units amount to rounded cents on create', async () => {
    vi.mocked(plansApi.createAdminPlan).mockResolvedValue(EXISTING_PLAN);
    const onSaved = vi.fn();

    render(<PlanFormModal plan={null} onClose={vi.fn()} onSaved={onSaved} />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'New Plan' } });
    fireEvent.change(screen.getByLabelText('Amount (major units, e.g. 9.99)'), {
      // 19.999 * 100 === 1999.8999...999 in floating point — a genuine
      // rounding case, not a round number, to prove Math.round is applied.
      target: { value: '19.999' },
    });
    fireEvent.change(screen.getByLabelText('Currency (ISO-4217, e.g. USD)'), {
      target: { value: 'usd' },
    });
    fireEvent.change(screen.getByLabelText('Interval days'), { target: { value: '30' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor((): void => {
      expect(plansApi.createAdminPlan).toHaveBeenCalledWith(
        expect.objectContaining({ amountCents: 2000, currency: 'USD' }),
      );
    });
    await waitFor((): void => expect(onSaved).toHaveBeenCalled());
  });

  it('pre-fills the amount field in major units when editing', () => {
    render(<PlanFormModal plan={EXISTING_PLAN} onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(screen.getByLabelText('Amount (major units, e.g. 9.99)')).toHaveValue(9.99);
  });

  it('calls update, not create, when editing an existing plan', async () => {
    vi.mocked(plansApi.updateAdminPlan).mockResolvedValue(EXISTING_PLAN);

    render(<PlanFormModal plan={EXISTING_PLAN} onClose={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByText('Save'));

    await waitFor((): void => {
      expect(plansApi.updateAdminPlan).toHaveBeenCalledWith('p-1', expect.any(Object));
    });
    expect(plansApi.createAdminPlan).not.toHaveBeenCalled();
  });

  it('rejects an invalid currency without calling the API', async () => {
    render(<PlanFormModal plan={null} onClose={vi.fn()} onSaved={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'New Plan' } });
    fireEvent.change(screen.getByLabelText('Amount (major units, e.g. 9.99)'), {
      target: { value: '9.99' },
    });
    fireEvent.change(screen.getByLabelText('Currency (ISO-4217, e.g. USD)'), {
      target: { value: 'US' },
    });
    fireEvent.click(screen.getByText('Save'));

    expect(
      await screen.findByText('Currency must be a 3-letter ISO code (e.g. USD)'),
    ).toBeInTheDocument();
    expect(plansApi.createAdminPlan).not.toHaveBeenCalled();
  });
});
