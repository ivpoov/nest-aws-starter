import { NotificationAudienceEnum, NotificationTypeEnum } from '@nest-aws-starter/shared';
import type { ReactElement } from 'react';
import { useState } from 'react';
import type { NotificationHistoryFiltersInterface } from '../../interfaces/notification-history-filters.interface';
import { Button } from '../ui/Button';

interface NotificationHistoryFilterBarPropsInterface {
  readonly filters: NotificationHistoryFiltersInterface;
  readonly onToggleType: (type: NotificationTypeEnum) => void;
  readonly onClearType: () => void;
  readonly onToggleAudience: (audience: NotificationAudienceEnum) => void;
  readonly onClearAudience: () => void;
}

const TYPE_OPTIONS: NotificationTypeEnum[] = Object.values(NotificationTypeEnum);
const AUDIENCE_OPTIONS: NotificationAudienceEnum[] = Object.values(NotificationAudienceEnum);

function chipClassName(isActive: boolean): string {
  return isActive
    ? 'rounded-full bg-accent px-3 py-1 text-xs text-accent-content'
    : 'rounded-full border border-edge px-3 py-1 text-xs text-content-muted hover:text-content';
}

export function NotificationHistoryFilterBar({
  filters,
  onToggleType,
  onClearType,
  onToggleAudience,
  onClearAudience,
}: NotificationHistoryFilterBarPropsInterface): ReactElement {
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
      <div className={`${isExpanded ? 'mt-3 flex' : 'hidden'} flex-col gap-4 md:mt-0 md:flex`}>
        <div className="flex flex-col gap-1">
          <span className="text-sm text-content-muted">Audience</span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onClearAudience}
              className={chipClassName(filters.audience === null)}
            >
              All
            </button>
            {AUDIENCE_OPTIONS.map(
              (audience): ReactElement => (
                <button
                  key={audience}
                  type="button"
                  onClick={(): void => onToggleAudience(audience)}
                  className={chipClassName(filters.audience === audience)}
                >
                  {audience}
                </button>
              ),
            )}
          </div>
        </div>
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
