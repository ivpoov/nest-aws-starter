import type { ApiErrorInterface, StatisticsRevenueByPlanInterface } from '@nest-aws-starter/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RevenueByPlanBreakdown } from '../components/Statistics/RevenueByPlanBreakdown';

const ITEMS: StatisticsRevenueByPlanInterface[] = [
  { planId: 'plan-1', planName: 'Pro', amountCents: 3_000 },
  { planId: 'plan-2', planName: 'Basic', amountCents: 1_000 },
];

const ERROR: ApiErrorInterface = {
  statusCode: 500,
  code: 'INTERNAL',
  details: 'Something broke',
  meta: undefined,
  timestamp: '2026-08-04T00:00:00.000Z',
  path: '/admin/statistics/overview',
};

describe('RevenueByPlanBreakdown', () => {
  it('shows a loader while loading with no items yet', () => {
    render(<RevenueByPlanBreakdown items={[]} isLoading={true} error={null} onRetry={vi.fn()} />);

    expect(screen.getByLabelText('Loading')).toBeInTheDocument();
  });

  it('shows the error state when there is no data yet', () => {
    render(<RevenueByPlanBreakdown items={[]} isLoading={false} error={ERROR} onRetry={vi.fn()} />);

    expect(screen.getByText('Something broke')).toBeInTheDocument();
  });

  it('shows the empty state when there are no items and no error', () => {
    render(<RevenueByPlanBreakdown items={[]} isLoading={false} error={null} onRetry={vi.fn()} />);

    expect(screen.getByText('No plan revenue in the last 30 days')).toBeInTheDocument();
  });

  it('renders the chart and accessible table with formatted amounts', () => {
    render(
      <RevenueByPlanBreakdown items={ITEMS} isLoading={false} error={null} onRetry={vi.fn()} />,
    );

    expect(document.querySelector('.recharts-responsive-container')).not.toBeNull();
    expect(screen.getByText('Pro')).toBeInTheDocument();
    expect(screen.getByText('Basic')).toBeInTheDocument();
    expect(screen.getByText('$30.00')).toBeInTheDocument();
    expect(screen.getByText('$10.00')).toBeInTheDocument();
  });
});
