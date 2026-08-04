import type {
  ApiErrorInterface,
  StatisticsCountBreakdownInterface,
} from '@nest-aws-starter/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UsersByStatusBreakdown } from '../components/Statistics/UsersByStatusBreakdown';

const ITEMS: StatisticsCountBreakdownInterface[] = [
  { key: 'ACTIVE', count: 1240 },
  { key: 'BLOCKED', count: 44 },
];

const ERROR: ApiErrorInterface = {
  statusCode: 500,
  code: 'INTERNAL',
  details: 'Something broke',
  meta: undefined,
  timestamp: '2026-08-04T00:00:00.000Z',
  path: '/admin/statistics/overview',
};

describe('UsersByStatusBreakdown', () => {
  it('renders the status labels and counts from the fixture', () => {
    render(
      <UsersByStatusBreakdown items={ITEMS} isLoading={false} error={null} onRetry={vi.fn()} />,
    );

    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    expect(screen.getByText('1,240')).toBeInTheDocument();
    expect(screen.getByText('BLOCKED')).toBeInTheDocument();
    expect(screen.getByText('44')).toBeInTheDocument();
  });

  it('shows the empty state when there are no users yet', () => {
    render(<UsersByStatusBreakdown items={[]} isLoading={false} error={null} onRetry={vi.fn()} />);

    expect(screen.getByText('No users yet')).toBeInTheDocument();
  });

  it('keeps the list visible and shows an inline error when a refetch fails with existing data', () => {
    render(
      <UsersByStatusBreakdown items={ITEMS} isLoading={false} error={ERROR} onRetry={vi.fn()} />,
    );

    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    expect(screen.getByText('Something broke')).toBeInTheDocument();
  });
});
