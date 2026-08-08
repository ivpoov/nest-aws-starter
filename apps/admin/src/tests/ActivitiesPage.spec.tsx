import { ActivityTypeEnum } from '@nest-aws-starter/shared';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as activitiesApi from '../apis/activities';
import type { ActivityFiltersInterface } from '../interfaces/activity-filters.interface';
import { ActivitiesPage } from '../pages/ActivitiesPage';

vi.mock('../apis/activities');

function renderActivitiesPage(initialEntry = '/activities'): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <ActivitiesPage />
    </MemoryRouter>,
  );
}

function lastRequestedFilters(): ActivityFiltersInterface {
  const calls = vi.mocked(activitiesApi.fetchAdminActivities).mock.calls;
  const [, , filters] = calls[calls.length - 1] as [
    number,
    string | null,
    ActivityFiltersInterface,
  ];

  return filters;
}

describe('ActivitiesPage', () => {
  beforeEach(() => {
    vi.mocked(activitiesApi.fetchAdminActivities).mockReset();
    vi.mocked(activitiesApi.fetchAdminActivities).mockResolvedValue({
      items: [],
      nextCursor: null,
    } as never);
  });

  it('requests no type filter without a ?type= param', async () => {
    renderActivitiesPage();

    await waitFor(() => expect(activitiesApi.fetchAdminActivities).toHaveBeenCalled());

    expect(lastRequestedFilters().type).toBeNull();
  });

  // The SUSPICIOUS_LOGIN deep link (see resolveNotificationLink): the
  // notification carries no userId, so it lands on the matching activity type.
  it('preselects the type carried in a ?type= deep link', async () => {
    renderActivitiesPage(`/activities?type=${ActivityTypeEnum.AUTH_SUSPICIOUS_LOGIN}`);

    await waitFor(() =>
      expect(lastRequestedFilters().type).toBe(ActivityTypeEnum.AUTH_SUSPICIOUS_LOGIN),
    );
  });

  // A stale or hand-edited value must never reach the API as a filter it
  // rejects — that turns a deep link into an error page.
  it('ignores a ?type= value that is not an activity type', async () => {
    renderActivitiesPage('/activities?type=NOT_A_REAL_TYPE');

    await waitFor(() => expect(activitiesApi.fetchAdminActivities).toHaveBeenCalled());

    expect(lastRequestedFilters().type).toBeNull();
  });
});
