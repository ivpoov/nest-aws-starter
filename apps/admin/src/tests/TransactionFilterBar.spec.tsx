import { TransactionStatusEnum } from '@nest-aws-starter/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TransactionFilterBar } from '../components/Transactions/TransactionFilterBar';
import type { TransactionFiltersInterface } from '../interfaces/transaction-filters.interface';

const EMPTY_FILTERS: TransactionFiltersInterface = {
  userId: '',
  status: null,
  dateFrom: '',
  dateTo: '',
};

describe('TransactionFilterBar', () => {
  it('calls onToggleStatus with the clicked status chip', () => {
    const onToggleStatus = vi.fn();

    render(
      <TransactionFilterBar
        filters={EMPTY_FILTERS}
        selectedUserLabel={null}
        onToggleStatus={onToggleStatus}
        onClearStatus={vi.fn()}
        onDateFromChange={vi.fn()}
        onDateToChange={vi.fn()}
        onSelectUser={vi.fn()}
        onClearUser={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText(TransactionStatusEnum.FAILED));

    expect(onToggleStatus).toHaveBeenCalledWith(TransactionStatusEnum.FAILED);
  });

  it('calls onClearStatus when the All chip is clicked', () => {
    const onClearStatus = vi.fn();

    render(
      <TransactionFilterBar
        filters={{ ...EMPTY_FILTERS, status: TransactionStatusEnum.SUCCEEDED }}
        selectedUserLabel={null}
        onToggleStatus={vi.fn()}
        onClearStatus={onClearStatus}
        onDateFromChange={vi.fn()}
        onDateToChange={vi.fn()}
        onSelectUser={vi.fn()}
        onClearUser={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('All'));

    expect(onClearStatus).toHaveBeenCalled();
  });

  it('calls onDateFromChange and onDateToChange when the date inputs change', () => {
    const onDateFromChange = vi.fn();
    const onDateToChange = vi.fn();

    render(
      <TransactionFilterBar
        filters={EMPTY_FILTERS}
        selectedUserLabel={null}
        onToggleStatus={vi.fn()}
        onClearStatus={vi.fn()}
        onDateFromChange={onDateFromChange}
        onDateToChange={onDateToChange}
        onSelectUser={vi.fn()}
        onClearUser={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-08-01' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-08-03' } });

    expect(onDateFromChange).toHaveBeenCalledWith('2026-08-01');
    expect(onDateToChange).toHaveBeenCalledWith('2026-08-03');
  });

  it('shows the selected user label and calls onClearUser when cleared', () => {
    const onClearUser = vi.fn();

    render(
      <TransactionFilterBar
        filters={{ ...EMPTY_FILTERS, userId: 'u-1' }}
        selectedUserLabel="Jane Doe (jane@example.com)"
        onToggleStatus={vi.fn()}
        onClearStatus={vi.fn()}
        onDateFromChange={vi.fn()}
        onDateToChange={vi.fn()}
        onSelectUser={vi.fn()}
        onClearUser={onClearUser}
      />,
    );

    expect(screen.getByText(/Filtering by Jane Doe/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Clear'));

    expect(onClearUser).toHaveBeenCalled();
  });
});
