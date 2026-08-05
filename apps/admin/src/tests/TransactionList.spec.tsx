import type {
  AdminTransactionResponseInterface,
  ApiErrorInterface,
} from '@nest-aws-starter/shared';
import { TransactionStatusEnum } from '@nest-aws-starter/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TransactionList } from '../components/Transactions/TransactionList';

const TRANSACTION: AdminTransactionResponseInterface = {
  id: 't-1',
  userId: 'u-1234567890',
  status: TransactionStatusEnum.SUCCEEDED,
  amountCents: 1900,
  currency: 'USD',
  provider: 'STRIPE',
  providerRef: 'in_1AbCDeFGhIJkLmNoPQrStuVW',
  createdAt: '2026-08-01T00:00:00.000Z',
  subscriptionId: null,
};

const ERROR: ApiErrorInterface = {
  statusCode: 500,
  code: 'INTERNAL',
  details: 'Something broke',
  timestamp: '2026-08-01T00:00:00.000Z',
  path: '/admin/transactions',
};

describe('TransactionList', () => {
  it('renders the empty state when there are no transactions', () => {
    render(
      <TransactionList
        transactions={[]}
        isLoading={false}
        error={null}
        hasMore={false}
        onLoadMore={vi.fn()}
      />,
    );

    expect(screen.getByText('No transactions match these filters')).toBeInTheDocument();
  });

  it('renders the error state when the list is empty and failed to load', () => {
    render(
      <TransactionList
        transactions={[]}
        isLoading={false}
        error={ERROR}
        hasMore={false}
        onLoadMore={vi.fn()}
      />,
    );

    expect(screen.getByText('Something broke')).toBeInTheDocument();
  });

  it('renders the formatted amount, status badge, provider, and a truncated user id/reference', () => {
    render(
      <TransactionList
        transactions={[TRANSACTION]}
        isLoading={false}
        error={null}
        hasMore={false}
        onLoadMore={vi.fn()}
      />,
    );

    expect(screen.getByText('$19.00')).toBeInTheDocument();
    expect(screen.getByText('SUCCEEDED')).toBeInTheDocument();
    expect(screen.getByText('STRIPE')).toBeInTheDocument();
    expect(screen.getByText('u-123456…')).toBeInTheDocument();
    expect(screen.getByText('in_1AbCDeFGhIJkL…')).toBeInTheDocument();
  });

  it('keeps the table visible and surfaces the error when a later page fails', () => {
    render(
      <TransactionList
        transactions={[TRANSACTION]}
        isLoading={false}
        error={ERROR}
        hasMore={false}
        onLoadMore={vi.fn()}
      />,
    );

    expect(screen.getByText('SUCCEEDED')).toBeInTheDocument();
    expect(screen.getByText('Something broke')).toBeInTheDocument();
  });

  it('calls onLoadMore when the load more button is clicked', () => {
    const onLoadMore = vi.fn();

    render(
      <TransactionList
        transactions={[TRANSACTION]}
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
