import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as usersApi from '../apis/users';
import { useAdminUsers } from '../hooks/users/useAdminUsers';

vi.mock('../apis/users');

function adminUser(id: string): Record<string, unknown> {
  return {
    id,
    displayName: `User ${id}`,
    role: 'USER',
    status: 'ACTIVE',
    email: `${id}@example.com`,
    methodTypes: ['EMAIL'],
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  };
}

describe('useAdminUsers', () => {
  beforeEach(() => {
    vi.mocked(usersApi.fetchAdminUsers).mockResolvedValue({
      items: [adminUser('u-1')],
      nextCursor: 'u-1',
    } as never);
  });

  it('loads the first page and reports more', async () => {
    const { result } = renderHook(() => useAdminUsers(''));

    await waitFor((): void => expect(result.current.isLoading).toBe(false));

    expect(result.current.users).toHaveLength(1);
    expect(result.current.hasMore).toBe(true);
  });

  it('appends the next page through the cursor', async () => {
    const { result } = renderHook(() => useAdminUsers(''));

    await waitFor((): void => expect(result.current.isLoading).toBe(false));

    vi.mocked(usersApi.fetchAdminUsers).mockResolvedValue({
      items: [adminUser('u-2')],
      nextCursor: null,
    } as never);

    await act(async (): Promise<void> => {
      await result.current.loadMore();
    });

    expect(usersApi.fetchAdminUsers).toHaveBeenLastCalledWith(20, 'u-1', '');
    expect(result.current.users.map((user): string => user.id)).toEqual(['u-1', 'u-2']);
    expect(result.current.hasMore).toBe(false);
  });

  it('restarts from a fresh page when the search changes', async () => {
    const { result, rerender } = renderHook(
      ({ search }: { search: string }) => useAdminUsers(search),
      { initialProps: { search: '' } },
    );

    await waitFor((): void => expect(result.current.isLoading).toBe(false));

    rerender({ search: 'igor' });

    await waitFor((): void => {
      expect(usersApi.fetchAdminUsers).toHaveBeenLastCalledWith(20, null, 'igor');
    });
  });

  it('reload refetches the first page, discarding any loaded-more pages', async () => {
    const { result } = renderHook(() => useAdminUsers(''));

    await waitFor((): void => expect(result.current.isLoading).toBe(false));

    vi.mocked(usersApi.fetchAdminUsers).mockResolvedValue({
      items: [adminUser('u-3')],
      nextCursor: null,
    } as never);

    await act(async (): Promise<void> => {
      await result.current.reload();
    });

    expect(usersApi.fetchAdminUsers).toHaveBeenLastCalledWith(20, null, '');
    expect(result.current.users.map((user): string => user.id)).toEqual(['u-3']);
  });
});
