import type {
  ApiErrorInterface,
  StatisticsCountBreakdownInterface,
} from '@nest-aws-starter/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AuthMethodBreakdown } from '../components/Statistics/AuthMethodBreakdown';

const ITEMS: StatisticsCountBreakdownInterface[] = [
  { key: 'EMAIL', count: 700 },
  { key: 'GOOGLE', count: 420 },
  { key: 'FACEBOOK', count: 110 },
  { key: 'DISCORD', count: 54 },
];

const ERROR: ApiErrorInterface = {
  statusCode: 500,
  code: 'INTERNAL',
  details: 'Something broke',
  meta: undefined,
  timestamp: '2026-08-04T00:00:00.000Z',
  path: '/admin/statistics/overview',
};

describe('AuthMethodBreakdown', () => {
  it('renders the auth-method keys and counts from the fixture', () => {
    render(<AuthMethodBreakdown items={ITEMS} isLoading={false} error={null} onRetry={vi.fn()} />);

    expect(screen.getByText('EMAIL')).toBeInTheDocument();
    expect(screen.getByText('700')).toBeInTheDocument();
    expect(screen.getByText('GOOGLE')).toBeInTheDocument();
    expect(screen.getByText('420')).toBeInTheDocument();
    expect(screen.getByText('FACEBOOK')).toBeInTheDocument();
    expect(screen.getByText('110')).toBeInTheDocument();
    expect(screen.getByText('DISCORD')).toBeInTheDocument();
    expect(screen.getByText('54')).toBeInTheDocument();
  });

  it('shows the empty state when there are no auth methods yet', () => {
    render(<AuthMethodBreakdown items={[]} isLoading={false} error={null} onRetry={vi.fn()} />);

    expect(screen.getByText('No auth methods yet')).toBeInTheDocument();
  });

  it('keeps the breakdown visible and shows an inline error when a refetch fails with existing data', () => {
    render(<AuthMethodBreakdown items={ITEMS} isLoading={false} error={ERROR} onRetry={vi.fn()} />);

    expect(screen.getByText('EMAIL')).toBeInTheDocument();
    expect(screen.getByText('Something broke')).toBeInTheDocument();
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
      <AuthMethodBreakdown items={ITEMS} isLoading={false} error={null} onRetry={vi.fn()} />,
    );
    const hidden: Element | null = container.querySelector('.sr-only');

    expect(hidden).not.toBeNull();
    expect(hidden?.tagName).not.toBe('TABLE');
    expect(hidden?.querySelector('table')).not.toBeNull();
  });
});
