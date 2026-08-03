import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as usersApi from '../apis/users';
import { UserDetailDrawer } from '../components/Users/UserDetailDrawer';

vi.mock('../apis/users');

const adminUser = {
  id: 'u-1',
  displayName: 'Igor',
  role: 'USER',
  status: 'ACTIVE',
  email: 'igor@example.com',
  methodTypes: ['EMAIL'],
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
};

describe('UserDetailDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usersApi.fetchAdminUser).mockResolvedValue(adminUser as never);
    vi.mocked(usersApi.fetchAdminUserSessions).mockResolvedValue([
      { id: 's-1', device: 'Chrome', ip: '127.0.0.1', isCurrent: true, isImpersonated: true },
    ] as never);
    vi.mocked(usersApi.updateAdminUserStatus).mockResolvedValue({
      ...adminUser,
      status: 'BLOCKED',
    } as never);
    vi.mocked(usersApi.loginAsAdminUser).mockResolvedValue({ code: 'exchange-code-1' } as never);
    vi.stubGlobal('open', vi.fn());
  });

  it('shows an impersonated badge on flagged sessions', async () => {
    render(<UserDetailDrawer userId="u-1" onClose={vi.fn()} />);

    expect(await screen.findByText('Impersonated')).toBeInTheDocument();
  });

  it('blocks the user through the confirm step and notifies the parent', async () => {
    const onUserChanged = vi.fn();

    render(<UserDetailDrawer userId="u-1" onClose={vi.fn()} onUserChanged={onUserChanged} />);

    fireEvent.click(await screen.findByText('Block user'));
    fireEvent.click(screen.getByText('Confirm'));

    await waitFor((): void => {
      expect(usersApi.updateAdminUserStatus).toHaveBeenCalledWith('u-1', 'BLOCKED');
    });
    await waitFor((): void => expect(onUserChanged).toHaveBeenCalled());
  });

  it('cancels the block confirm step without calling the api', async () => {
    render(<UserDetailDrawer userId="u-1" onClose={vi.fn()} />);

    fireEvent.click(await screen.findByText('Block user'));
    fireEvent.click(screen.getByText('Cancel'));

    expect(await screen.findByText('Block user')).toBeInTheDocument();
    expect(usersApi.updateAdminUserStatus).not.toHaveBeenCalled();
  });

  it('logs in as the user and opens the web app callback URL in a new tab', async () => {
    render(<UserDetailDrawer userId="u-1" onClose={vi.fn()} />);

    fireEvent.click(await screen.findByText('Log in as user'));
    fireEvent.click(screen.getByText('Confirm'));

    await waitFor((): void => expect(usersApi.loginAsAdminUser).toHaveBeenCalledWith('u-1'));
    expect(window.open).toHaveBeenCalledWith(
      expect.stringContaining('/auth/callback?code=exchange-code-1'),
      '_blank',
      'noopener',
    );
  });
});
