import type { ReactElement } from 'react';
import { useState } from 'react';
import { ActivityFilterBar } from '../components/Activities/ActivityFilterBar';
import { ActivityList } from '../components/Activities/ActivityList';
import { useAdminActivities } from '../hooks/activities/useAdminActivities';
import type { ActivityFiltersInterface } from '../interfaces/activity-filters.interface';

const EMPTY_FILTERS: ActivityFiltersInterface = {
  userId: '',
  type: null,
  dateFrom: '',
  dateTo: '',
};

export function ActivitiesPage(): ReactElement {
  const [filters, setFilters] = useState<ActivityFiltersInterface>(EMPTY_FILTERS);
  const { activities, hasMore, isLoading, error, loadMore } = useAdminActivities(filters);

  return (
    <div className="flex max-w-5xl flex-col gap-4">
      <ActivityFilterBar filters={filters} onChange={setFilters} />
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
