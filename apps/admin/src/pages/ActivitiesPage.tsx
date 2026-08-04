import type { ReactElement } from 'react';
import { ActivityFilterBar } from '../components/Activities/ActivityFilterBar';
import { ActivityList } from '../components/Activities/ActivityList';
import { useActivityFilters } from '../hooks/activities/useActivityFilters';
import { useAdminActivities } from '../hooks/activities/useAdminActivities';

export function ActivitiesPage(): ReactElement {
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
