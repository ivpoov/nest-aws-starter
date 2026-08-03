import { ActivityTypeEnum } from '@nest-aws-starter/shared';
import type { ReactElement } from 'react';
import { useState } from 'react';
import type { ActivityFiltersInterface } from '../../interfaces/activity-filters.interface';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface ActivityFilterBarPropsInterface {
  readonly filters: ActivityFiltersInterface;
  readonly onChange: (filters: ActivityFiltersInterface) => void;
}

const TYPE_OPTIONS: ActivityTypeEnum[] = Object.values(ActivityTypeEnum);

function chipClassName(isActive: boolean): string {
  return isActive
    ? 'rounded-full bg-accent px-3 py-1 text-xs text-accent-content'
    : 'rounded-full border border-edge px-3 py-1 text-xs text-content-muted hover:text-content';
}

export function ActivityFilterBar({
  filters,
  onChange,
}: ActivityFilterBarPropsInterface): ReactElement {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  function handleToggleExpanded(): void {
    setIsExpanded(!isExpanded);
  }

  function handleTypeSelect(type: ActivityTypeEnum | null): void {
    onChange({ ...filters, type });
  }

  function handleUserIdChange(value: string): void {
    onChange({ ...filters, userId: value });
  }

  function handleDateFromChange(value: string): void {
    onChange({ ...filters, dateFrom: value ? `${value}T00:00:00.000Z` : '' });
  }

  function handleDateToChange(value: string): void {
    onChange({ ...filters, dateTo: value ? `${value}T23:59:59.000Z` : '' });
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
        <div className="max-w-xs grow">
          <Input label="User ID" value={filters.userId} onChange={handleUserIdChange} />
        </div>
        <Input
          label="From"
          type="date"
          value={filters.dateFrom.slice(0, 10)}
          onChange={handleDateFromChange}
        />
        <Input
          label="To"
          type="date"
          value={filters.dateTo.slice(0, 10)}
          onChange={handleDateToChange}
        />
        <div className="flex flex-col gap-1">
          <span className="text-sm text-content-muted">Type</span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={(): void => handleTypeSelect(null)}
              className={chipClassName(filters.type === null)}
            >
              All
            </button>
            {TYPE_OPTIONS.map(
              (type): ReactElement => (
                <button
                  key={type}
                  type="button"
                  onClick={(): void => handleTypeSelect(type)}
                  className={chipClassName(filters.type === type)}
                >
                  {type}
                </button>
              ),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
