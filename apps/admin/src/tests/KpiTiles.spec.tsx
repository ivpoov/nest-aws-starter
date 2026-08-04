import type { ApiErrorInterface, StatisticsTotalsInterface } from '@nest-aws-starter/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { KpiTiles } from '../components/Statistics/KpiTiles';

const ERROR: ApiErrorInterface = {
  statusCode: 500,
  code: 'INTERNAL',
  details: 'Something broke',
  meta: undefined,
  timestamp: '2026-08-04T00:00:00.000Z',
  path: '/admin/statistics/overview',
};

describe('KpiTiles', () => {
  it('shows a loader while loading with no totals yet', () => {
    render(<KpiTiles totals={null} isLoading={true} error={null} onRetry={vi.fn()} />);

    expect(screen.getByLabelText('Loading')).toBeInTheDocument();
  });

  it('shows the error state when there are no totals yet', () => {
    const onRetry = vi.fn();

    render(<KpiTiles totals={null} isLoading={false} error={ERROR} onRetry={onRetry} />);

    expect(screen.getByText('Something broke')).toBeInTheDocument();
  });

  it('renders "—" placeholders for revenue and MRR when the payment module is absent', () => {
    const totals: StatisticsTotalsInterface = {
      users: 10,
      activeSessions: 2,
      onlineNow: 1,
      newToday: 1,
      revenue: null,
      mrrCents: null,
    };

    render(<KpiTiles totals={totals} isLoading={false} error={null} onRetry={vi.fn()} />);

    expect(screen.getAllByText('—')).toHaveLength(2);
    expect(screen.getAllByText('Requires the payment module')).toHaveLength(2);
  });

  it('formats revenue and MRR as currency when populated', () => {
    const totals: StatisticsTotalsInterface = {
      users: 10,
      activeSessions: 2,
      onlineNow: 1,
      newToday: 1,
      revenue: 12_500,
      mrrCents: 4_900,
    };

    render(<KpiTiles totals={totals} isLoading={false} error={null} onRetry={vi.fn()} />);

    expect(screen.getByText('$125.00')).toBeInTheDocument();
    expect(screen.getByText('$49.00')).toBeInTheDocument();
  });
});
