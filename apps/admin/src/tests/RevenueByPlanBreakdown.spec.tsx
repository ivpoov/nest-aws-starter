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

  it('labels the null-plan row as unattributed instead of dropping it', () => {
    const items: StatisticsRevenueByPlanInterface[] = [
      ...ITEMS,
      { planId: null, planName: null, amountCents: 2_590 },
    ];

    render(
      <RevenueByPlanBreakdown items={items} isLoading={false} error={null} onRetry={vi.fn()} />,
    );

    expect(screen.getByRole('rowheader', { name: 'Unattributed' })).toBeInTheDocument();
    expect(screen.getByText('$25.90')).toBeInTheDocument();
  });

  // `sr-only` on the <table> itself does not hide it: CSS table layout treats
  // `height` as a minimum, so the table ignores the utility's 1px and sizes to
  // its content, and because the utility also positions it absolutely that
  // full-height box silently extends the document's scrollable area. With one
  // row per plan that put thousands of pixels of empty scroll under the admin
  // dashboard. jsdom computes no layout, so what is asserted here is the
  // structure that makes the clipping work: the hidden element is a block box
  // wrapping the table, never the table.
  it('hides the accessible table through a wrapper rather than styling the table', () => {
    const { container } = render(
      <RevenueByPlanBreakdown items={ITEMS} isLoading={false} error={null} onRetry={vi.fn()} />,
    );
    const hidden: Element | null = container.querySelector('.sr-only');

    expect(hidden).not.toBeNull();
    expect(hidden?.tagName).not.toBe('TABLE');
    expect(hidden?.querySelector('table')).not.toBeNull();
  });
});
