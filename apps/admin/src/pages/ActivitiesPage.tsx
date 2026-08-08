import { ActivityTypeEnum } from '@nest-aws-starter/shared';
import type { ReactElement } from 'react';
import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router';
import { ActivityFilterBar } from '../components/Activities/ActivityFilterBar';
import { ActivityList } from '../components/Activities/ActivityList';
import { useActivityFilters } from '../hooks/activities/useActivityFilters';
import { useAdminActivities } from '../hooks/activities/useAdminActivities';

function isActivityType(value: string): value is ActivityTypeEnum {
  return (Object.values(ActivityTypeEnum) as string[]).includes(value);
}

export function ActivitiesPage(): ReactElement {
  const [searchParams] = useSearchParams();
  const appliedTypeParamRef = useRef<string | null>(null);
  const {
    filters,
    selectedUserLabel,
    toggleType,
    clearType,
    setDateFrom,
    setDateTo,
    selectUser,
    clearUser,
  } = useActivityFilters();
  const { activities, hasMore, isLoading, error, loadMore } = useAdminActivities(filters);

  // Deep link from a SUSPICIOUS_LOGIN notification (see
  // resolveNotificationLink), which has no user to open and so lands on the
  // matching activity type instead. The value is validated against the enum
  // before it reaches the filter: a stale or hand-edited `?type=` would
  // otherwise be sent to the API as a filter it rejects, turning a deep link
  // into an error page.
  //
  // Each param value is applied exactly once, tracked in a ref: the param
  // stays in the URL after the chip is set, so re-running on `filters.type`
  // would fight an admin who toggles that chip back off. A *different*
  // `?type=` (a second notification click on the same mounted page) is still
  // picked up.
  useEffect(() => {
    const type: string | null = searchParams.get('type');

    if (type === null || appliedTypeParamRef.current === type) return;

    appliedTypeParamRef.current = type;

    if (!isActivityType(type) || filters.type === type) return;

    toggleType(type);
  }, [searchParams, filters.type, toggleType]);

  return (
    <div className="flex max-w-5xl flex-col gap-4">
      <ActivityFilterBar
        filters={filters}
        selectedUserLabel={selectedUserLabel}
        onToggleType={toggleType}
        onClearType={clearType}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onSelectUser={selectUser}
        onClearUser={clearUser}
      />
      <ActivityList
        activities={activities}
        isLoading={isLoading}
        error={error}
        hasMore={hasMore}
        onLoadMore={loadMore}
        emptyMessage="No activity matches these filters"
      />
    </div>
  );
}
