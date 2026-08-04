import type { ApiErrorInterface, StatisticsSeriesPointInterface } from '@nest-aws-starter/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RevenueChart } from '../components/Statistics/RevenueChart';

const POINTS: StatisticsSeriesPointInterface[] = [
  { date: '2026-08-01', value: 1_000 },
  { date: '2026-08-02', value: 2_500 },
];

const ERROR: ApiErrorInterface = {
  statusCode: 500,
  code: 'INTERNAL',
  details: 'Something broke',
  meta: undefined,
  timestamp: '2026-08-04T00:00:00.000Z',
  path: '/admin/statistics/series',
};

describe('RevenueChart', () => {
  it('shows a loader while loading with no points yet', () => {
    render(
      <RevenueChart
        points={[]}
        isLoading={true}
        error={null}
        days={30}
        onDaysChange={vi.fn()}
        onRetry={vi.fn()}
        isAvailable={true}
      />,
    );

    expect(screen.getByLabelText('Loading')).toBeInTheDocument();
  });

  it('shows the error state and retries when there is no data yet', () => {
    const onRetry = vi.fn();

    render(
      <RevenueChart
        points={[]}
        isLoading={false}
        error={ERROR}
        days={30}
        onDaysChange={vi.fn()}
        onRetry={onRetry}
        isAvailable={true}
      />,
    );

    expect(screen.getByText('Something broke')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Try again'));

    expect(onRetry).toHaveBeenCalled();
  });

  it('shows the empty state when there are no points and no error', () => {
    render(
      <RevenueChart
        points={[]}
        isLoading={false}
        error={null}
        days={30}
        onDaysChange={vi.fn()}
        onRetry={vi.fn()}
        isAvailable={true}
      />,
    );

    expect(screen.getByText('No revenue in this range')).toBeInTheDocument();
  });

  it('renders the chart when points are present', () => {
    render(
      <RevenueChart
        points={POINTS}
        isLoading={false}
        error={null}
        days={30}
        onDaysChange={vi.fn()}
        onRetry={vi.fn()}
        isAvailable={true}
      />,
    );

    expect(document.querySelector('.recharts-responsive-container')).not.toBeNull();
  });

  it('calls onDaysChange when a day switcher option is clicked', () => {
    const onDaysChange = vi.fn();

    render(
      <RevenueChart
        points={POINTS}
        isLoading={false}
        error={null}
        days={30}
        onDaysChange={onDaysChange}
        onRetry={vi.fn()}
        isAvailable={true}
      />,
    );

    fireEvent.click(screen.getByText('7d'));

    expect(onDaysChange).toHaveBeenCalledWith(7);
  });

  it('shows the unavailable placeholder instead of the chart when the payment module is absent', () => {
    // Reproduces the payment-subtracted deployment: even if the series call
    // somehow returned points (it won't — the API now hard-400s), this
    // guard must win and never render a chart under the "Revenue" heading.
    render(
      <RevenueChart
        points={POINTS}
        isLoading={false}
        error={null}
        days={30}
        onDaysChange={vi.fn()}
        onRetry={vi.fn()}
        isAvailable={false}
      />,
    );

    expect(screen.getByText('Revenue requires the payment module')).toBeInTheDocument();
    expect(document.querySelector('.recharts-responsive-container')).toBeNull();
    expect(screen.queryByText('7d')).not.toBeInTheDocument();
  });

  it('shows the unavailable placeholder even while a stale error from the unavailable series call is present', () => {
    render(
      <RevenueChart
        points={[]}
        isLoading={false}
        error={ERROR}
        days={30}
        onDaysChange={vi.fn()}
        onRetry={vi.fn()}
        isAvailable={false}
      />,
    );

    expect(screen.getByText('Revenue requires the payment module')).toBeInTheDocument();
    expect(screen.queryByText('Try again')).not.toBeInTheDocument();
  });
});
