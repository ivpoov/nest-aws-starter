import type { ApiErrorInterface, StatisticsSeriesPointInterface } from '@nest-aws-starter/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RegistrationsChart } from '../components/Statistics/RegistrationsChart';

const POINTS: StatisticsSeriesPointInterface[] = [
  { date: '2026-08-01', value: 3 },
  { date: '2026-08-02', value: 5 },
];

const ERROR: ApiErrorInterface = {
  statusCode: 500,
  code: 'INTERNAL',
  details: 'Something broke',
  meta: undefined,
  timestamp: '2026-08-04T00:00:00.000Z',
  path: '/admin/statistics/series',
};

describe('RegistrationsChart', () => {
  it('shows a loader while loading with no points yet', () => {
    render(
      <RegistrationsChart
        points={[]}
        isLoading={true}
        error={null}
        days={30}
        onDaysChange={vi.fn()}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Loading')).toBeInTheDocument();
  });

  it('shows the error state and retries when there is no data yet', () => {
    const onRetry = vi.fn();

    render(
      <RegistrationsChart
        points={[]}
        isLoading={false}
        error={ERROR}
        days={30}
        onDaysChange={vi.fn()}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByText('Something broke')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Try again'));

    expect(onRetry).toHaveBeenCalled();
  });

  it('shows the empty state when there are no points and no error', () => {
    render(
      <RegistrationsChart
        points={[]}
        isLoading={false}
        error={null}
        days={30}
        onDaysChange={vi.fn()}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText('No registrations in this range')).toBeInTheDocument();
  });

  it('renders the chart when points are present', () => {
    render(
      <RegistrationsChart
        points={POINTS}
        isLoading={false}
        error={null}
        days={30}
        onDaysChange={vi.fn()}
        onRetry={vi.fn()}
      />,
    );

    expect(document.querySelector('.recharts-responsive-container')).not.toBeNull();
  });

  it('keeps the chart visible and shows an inline error when a refetch fails with existing data', () => {
    render(
      <RegistrationsChart
        points={POINTS}
        isLoading={false}
        error={ERROR}
        days={30}
        onDaysChange={vi.fn()}
        onRetry={vi.fn()}
      />,
    );

    expect(document.querySelector('.recharts-responsive-container')).not.toBeNull();
    expect(screen.getByText('Something broke')).toBeInTheDocument();
    expect(screen.queryByText('Try again')).not.toBeInTheDocument();
  });

  it('calls onDaysChange when a day switcher option is clicked', () => {
    const onDaysChange = vi.fn();

    render(
      <RegistrationsChart
        points={POINTS}
        isLoading={false}
        error={null}
        days={30}
        onDaysChange={onDaysChange}
        onRetry={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('7d'));

    expect(onDaysChange).toHaveBeenCalledWith(7);
  });
});
