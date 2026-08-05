import type { AdminPlanResponseInterface } from '@nest-aws-starter/shared';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as plansApi from '../apis/plans';
import { PlanRowActions } from '../components/Plans/PlanRowActions';

vi.mock('../apis/plans');

const PLAN: AdminPlanResponseInterface = {
  id: 'p-1',
  name: 'Starter Monthly',
  description: '',
  amountCents: 999,
  currency: 'USD',
  intervalDays: 30,
  providerRefs: {},
  isActive: true,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
};

describe('PlanRowActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes the plan and notifies the parent on confirm', async () => {
    vi.mocked(plansApi.deleteAdminPlan).mockResolvedValue(undefined);
    const onChanged = vi.fn();

    render(<PlanRowActions plan={PLAN} onChanged={onChanged} />);
    fireEvent.click(screen.getByText('Delete'));
    fireEvent.click(screen.getByText('Confirm'));

    await waitFor((): void => expect(onChanged).toHaveBeenCalled());
  });

  it('renders PLAN_HAS_SUBSCRIPTIONS inline and does not notify the parent', async () => {
    vi.mocked(plansApi.deleteAdminPlan).mockRejectedValue({
      statusCode: 409,
      code: 'PLAN_HAS_SUBSCRIPTIONS',
      details: 'This plan has subscriptions and cannot be deleted',
      timestamp: '',
      path: '',
    });
    const onChanged = vi.fn();

    render(<PlanRowActions plan={PLAN} onChanged={onChanged} />);
    fireEvent.click(screen.getByText('Delete'));
    fireEvent.click(screen.getByText('Confirm'));

    expect(
      await screen.findByText('This plan has subscriptions and cannot be deleted'),
    ).toBeInTheDocument();
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('activates/deactivates on confirm', async () => {
    vi.mocked(plansApi.updateAdminPlanActivation).mockResolvedValue({ ...PLAN, isActive: false });
    const onChanged = vi.fn();

    render(<PlanRowActions plan={PLAN} onChanged={onChanged} />);
    fireEvent.click(screen.getByText('Deactivate'));
    fireEvent.click(screen.getByText('Confirm'));

    await waitFor((): void => {
      expect(plansApi.updateAdminPlanActivation).toHaveBeenCalledWith('p-1', { isActive: false });
    });
    await waitFor((): void => expect(onChanged).toHaveBeenCalled());
  });
});
