import {
  type AdminUserListResponseInterface,
  type AdminUserResponseInterface,
  type ApiErrorInterface,
  AuthMethodTypeEnum,
  UserRoleEnum,
  UserStatusEnum,
} from '@nest-aws-starter/shared';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as usersApi from '../apis/users';
import { UsersPage } from '../pages/UsersPage';

vi.mock('../apis/users');

const BLOCKED_USER: AdminUserResponseInterface = {
  id: 'u-42',
  email: 'blocked@example.com',
  displayName: 'Blocked Betty',
  role: UserRoleEnum.USER,
  status: UserStatusEnum.BLOCKED,
  methodTypes: [AuthMethodTypeEnum.EMAIL],
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
} as unknown as AdminUserResponseInterface;

// Deliberately does NOT contain u-42: the point of the deep link is that the
// drawer fetches by id, so it must open for a user who is not in the loaded
// page at all (blocked users are old news by the time an admin reads the
// notification).
const FIRST_PAGE: AdminUserListResponseInterface = {
  items: [
    {
      ...BLOCKED_USER,
      id: 'u-1',
      email: 'someone@example.com',
      displayName: 'Someone Else',
      status: UserStatusEnum.ACTIVE,
    },
  ],
  nextCursor: null,
} as unknown as AdminUserListResponseInterface;

const NOT_FOUND: ApiErrorInterface = {
  statusCode: 404,
  code: 'USER_NOT_FOUND',
  details: 'User not found',
  meta: undefined,
  timestamp: '2026-08-01T00:00:00.000Z',
  path: '/admin/users/u-gone',
};

function renderUsersPage(initialEntry = '/users'): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <UsersPage />
    </MemoryRouter>,
  );
}

describe('UsersPage', () => {
  beforeEach(() => {
    vi.mocked(usersApi.fetchAdminUsers).mockReset();
    vi.mocked(usersApi.fetchAdminUser).mockReset();
    vi.mocked(usersApi.fetchAdminUserSessions).mockReset();
    vi.mocked(usersApi.fetchAdminUsers).mockResolvedValue(FIRST_PAGE);
    vi.mocked(usersApi.fetchAdminUser).mockResolvedValue(BLOCKED_USER);
    vi.mocked(usersApi.fetchAdminUserSessions).mockResolvedValue([]);
  });

  it('does not open the drawer without a ?userId= param', async () => {
    renderUsersPage();

    await screen.findByText('Someone Else');

    expect(screen.queryByText('User detail')).not.toBeInTheDocument();
  });

  // The USER_BLOCKED deep link (see resolveNotificationLink) — the drawer
  // fetches by id, so it works from a cold navigation.
  it('opens the drawer for the user id carried in a ?userId= deep link', async () => {
    renderUsersPage('/users?userId=u-42');

    expect(await screen.findByText('User detail')).toBeInTheDocument();
    expect(await screen.findByText('Blocked Betty')).toBeInTheDocument();
    expect(usersApi.fetchAdminUser).toHaveBeenCalledWith('u-42');
  });

  // A link that dead-ends on a spinner is worse than no link: the drawer's
  // details view only rendered `error` inside its loaded-user branch, which a
  // failed fetch never reaches.
  it('shows the API error instead of spinning forever when the deep-linked id is gone', async () => {
    vi.mocked(usersApi.fetchAdminUser).mockRejectedValue(NOT_FOUND);
    vi.mocked(usersApi.fetchAdminUserSessions).mockRejectedValue(NOT_FOUND);

    renderUsersPage('/users?userId=u-gone');

    expect(await screen.findByText('User not found')).toBeInTheDocument();
  });

  it('closes the drawer and clears the param, without reopening it', async () => {
    renderUsersPage('/users?userId=u-42');

    await screen.findByText('Blocked Betty');

    screen.getByRole('button', { name: 'Close' }).click();

    await waitFor(() => expect(screen.queryByText('User detail')).not.toBeInTheDocument());
  });
});
