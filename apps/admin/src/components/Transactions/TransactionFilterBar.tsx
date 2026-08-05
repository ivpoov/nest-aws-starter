import { TransactionStatusEnum } from '@nest-aws-starter/shared';
import type { ReactElement } from 'react';
import { useState } from 'react';
import type { TransactionFiltersInterface } from '../../interfaces/transaction-filters.interface';
import { UserSearchFilter } from '../Activities/UserSearchFilter';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface TransactionFilterBarPropsInterface {
  readonly filters: TransactionFiltersInterface;
  readonly selectedUserLabel: string | null;
  readonly onToggleStatus: (status: TransactionStatusEnum) => void;
  readonly onClearStatus: () => void;
  readonly onDateFromChange: (value: string) => void;
  readonly onDateToChange: (value: string) => void;
  readonly onSelectUser: (userId: string, label: string) => void;
  readonly onClearUser: () => void;
}

const STATUS_OPTIONS: TransactionStatusEnum[] = Object.values(TransactionStatusEnum);

function chipClassName(isActive: boolean): string {
  return isActive
    ? 'rounded-full bg-accent px-3 py-1 text-xs text-accent-content'
    : 'rounded-full border border-edge px-3 py-1 text-xs text-content-muted hover:text-content';
}

export function TransactionFilterBar({
  filters,
  selectedUserLabel,
  onToggleStatus,
  onClearStatus,
  onDateFromChange,
  onDateToChange,
  onSelectUser,
  onClearUser,
}: TransactionFilterBarPropsInterface): ReactElement {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  function handleToggleExpanded(): void {
    setIsExpanded(!isExpanded);
  }

  return (
    <div className="rounded-xl border border-edge bg-surface-raised p-4">
      <div className="md:hidden">
        <Button variant="ghost" onClick={handleToggleExpanded}>
          {isExpanded ? 'Hide filters' : 'Show filters'}
        </Button>
      </div>
      <div
        className={`${isExpanded ? 'mt-3 flex' : 'hidden'} flex-col gap-3 md:mt-0 md:flex md:flex-row md:flex-wrap md:items-end md:gap-4`}
      >
        <UserSearchFilter
          selectedUserLabel={selectedUserLabel}
          onSelectUser={onSelectUser}
          onClearUser={onClearUser}
        />
        <Input
          label="From"
          type="date"
          value={filters.dateFrom.slice(0, 10)}
          onChange={onDateFromChange}
        />
        <Input
          label="To"
          type="date"
          value={filters.dateTo.slice(0, 10)}
          onChange={onDateToChange}
        />
        <div className="flex flex-col gap-1">
          <span className="text-sm text-content-muted">Status</span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onClearStatus}
              className={chipClassName(filters.status === null)}
            >
              All
            </button>
            {STATUS_OPTIONS.map(
              (status): ReactElement => (
                <button
                  key={status}
                  type="button"
                  onClick={(): void => onToggleStatus(status)}
                  className={chipClassName(filters.status === status)}
                >
                  {status}
                </button>
              ),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
