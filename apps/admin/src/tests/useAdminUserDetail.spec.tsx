import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as usersApi from '../apis/users';
import { useAdminUserDetail } from '../hooks/users/useAdminUserDetail';

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

describe('useAdminUserDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usersApi.fetchAdminUser).mockResolvedValue(adminUser as never);
    vi.mocked(usersApi.fetchAdminUserSessions).mockResolvedValue([] as never);
    vi.mocked(usersApi.updateAdminUserStatus).mockResolvedValue({
      ...adminUser,
      status: 'BLOCKED',
    } as never);
    vi.mocked(usersApi.loginAsAdminUser).mockResolvedValue({ code: 'exchange-code-1' } as never);
    vi.stubGlobal('open', vi.fn());
  });

  it('loads the user and their sessions on mount', async () => {
    const { result } = renderHook(() => useAdminUserDetail('u-1'));

    await waitFor((): void => expect(result.current.isLoading).toBe(false));

    expect(result.current.user).toEqual(adminUser);
    expect(usersApi.fetchAdminUser).toHaveBeenCalledWith('u-1');
  });

  it('updates status and reloads the detail', async () => {
    const { result } = renderHook(() => useAdminUserDetail('u-1'));

    await waitFor((): void => expect(result.current.isLoading).toBe(false));

    await act(async (): Promise<void> => {
      await result.current.updateStatus('BLOCKED' as never);
    });

    expect(usersApi.updateAdminUserStatus).toHaveBeenCalledWith('u-1', 'BLOCKED', undefined);
    expect(usersApi.fetchAdminUser).toHaveBeenCalledTimes(2);
    expect(result.current.isUpdatingStatus).toBe(false);
  });

  it('passes an optional reason through to the api', async () => {
    const { result } = renderHook(() => useAdminUserDetail('u-1'));

    await waitFor((): void => expect(result.current.isLoading).toBe(false));

    await act(async (): Promise<void> => {
      await result.current.updateStatus('BLOCKED' as never, 'Repeated ToS violations');
    });

    expect(usersApi.updateAdminUserStatus).toHaveBeenCalledWith(
      'u-1',
      'BLOCKED',
      'Repeated ToS violations',
    );
  });

  it('surfaces the error envelope when the status update fails', async () => {
    vi.mocked(usersApi.updateAdminUserStatus).mockRejectedValue({
      statusCode: 409,
      code: 'USER_CANNOT_BLOCK_SELF',
      details: 'Admins cannot block their own account',
    });

    const { result } = renderHook(() => useAdminUserDetail('u-1'));

    await waitFor((): void => expect(result.current.isLoading).toBe(false));

    await act(async (): Promise<void> => {
      await result.current.updateStatus('BLOCKED' as never);
    });

    expect(result.current.error?.code).toBe('USER_CANNOT_BLOCK_SELF');
  });

  it('mints a login-as exchange code and opens the web app callback URL', async () => {
    const { result } = renderHook(() => useAdminUserDetail('u-1'));

    await waitFor((): void => expect(result.current.isLoading).toBe(false));

    await act(async (): Promise<void> => {
      await result.current.loginAs();
    });

    expect(usersApi.loginAsAdminUser).toHaveBeenCalledWith('u-1');
    expect(window.open).toHaveBeenCalledWith(
      expect.stringContaining('/auth/callback?code=exchange-code-1'),
      '_blank',
      'noopener',
    );
    expect(result.current.isLoggingIn).toBe(false);
  });
});
