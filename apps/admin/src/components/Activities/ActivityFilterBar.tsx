import { ActivityTypeEnum } from '@nest-aws-starter/shared';
import type { ReactElement } from 'react';
import { useState } from 'react';
import type { ActivityFiltersInterface } from '../../interfaces/activity-filters.interface';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { UserSearchFilter } from './UserSearchFilter';

interface ActivityFilterBarPropsInterface {
  readonly filters: ActivityFiltersInterface;
  readonly selectedUserLabel: string | null;
  readonly onToggleType: (type: ActivityTypeEnum) => void;
  readonly onClearType: () => void;
  readonly onDateFromChange: (value: string) => void;
  readonly onDateToChange: (value: string) => void;
  readonly onSelectUser: (userId: string, label: string) => void;
  readonly onClearUser: () => void;
}

const TYPE_OPTIONS: ActivityTypeEnum[] = Object.values(ActivityTypeEnum);

function chipClassName(isActive: boolean): string {
  return isActive
    ? 'rounded-full bg-accent px-3 py-1 text-xs text-accent-content'
    : 'rounded-full border border-edge px-3 py-1 text-xs text-content-muted hover:text-content';
}

export function ActivityFilterBar({
  filters,
  selectedUserLabel,
  onToggleType,
  onClearType,
  onDateFromChange,
  onDateToChange,
  onSelectUser,
  onClearUser,
}: ActivityFilterBarPropsInterface): ReactElement {
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
          <span className="text-sm text-content-muted">Type</span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onClearType}
              className={chipClassName(filters.type === null)}
            >
              All
            </button>
            {TYPE_OPTIONS.map(
              (type): ReactElement => (
                <button
                  key={type}
                  type="button"
                  onClick={(): void => onToggleType(type)}
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
