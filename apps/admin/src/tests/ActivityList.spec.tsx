import type { ActivityResponseInterface, ApiErrorInterface } from '@nest-aws-starter/shared';
import { ActivityTypeEnum } from '@nest-aws-starter/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ActivityList } from '../components/Activities/ActivityList';

const ACTIVITY: ActivityResponseInterface = {
  id: 'a-1',
  userId: 'u-1',
  actorId: null,
  sessionId: null,
  type: ActivityTypeEnum.AUTH_LOGIN,
  meta: null,
  ip: '127.0.0.1',
  createdAt: '2026-08-01T00:00:00.000Z',
};

const ERROR: ApiErrorInterface = {
  statusCode: 500,
  code: 'INTERNAL',
  details: 'Something broke',
  timestamp: '2026-08-01T00:00:00.000Z',
  path: '/admin/activities',
};

describe('ActivityList', () => {
  it('renders the empty state when there is no activity', () => {
    render(
      <ActivityList
        activities={[]}
        isLoading={false}
        error={null}
        hasMore={false}
        onLoadMore={vi.fn()}
      />,
    );

    expect(screen.getByText('No activity found')).toBeInTheDocument();
  });

  it('renders the error state when the list is empty and failed to load', () => {
    render(
      <ActivityList
        activities={[]}
        isLoading={false}
        error={ERROR}
        hasMore={false}
        onLoadMore={vi.fn()}
      />,
    );

    expect(screen.getByText('Something broke')).toBeInTheDocument();
  });

  it('keeps the table visible and surfaces the error when a later page fails', () => {
    render(
      <ActivityList
        activities={[ACTIVITY]}
        isLoading={false}
        error={ERROR}
        hasMore={false}
        onLoadMore={vi.fn()}
      />,
    );

    expect(screen.getByText('AUTH_LOGIN')).toBeInTheDocument();
    expect(screen.getByText('Something broke')).toBeInTheDocument();
  });

  it('calls onLoadMore when the load more button is clicked', () => {
    const onLoadMore = vi.fn();

    render(
      <ActivityList
        activities={[ACTIVITY]}
        isLoading={false}
        error={null}
        hasMore={true}
        onLoadMore={onLoadMore}
      />,
    );

    fireEvent.click(screen.getByText('Load more'));

    expect(onLoadMore).toHaveBeenCalled();
  });
});
