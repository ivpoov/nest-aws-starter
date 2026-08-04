import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as usersApi from '../apis/users';
import { useUserSearch } from '../hooks/users/useUserSearch';

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

describe('useUserSearch', () => {
  beforeEach(() => {
    vi.mocked(usersApi.fetchAdminUsers).mockReset();
    vi.mocked(usersApi.fetchAdminUsers).mockResolvedValue({
      items: [adminUser('u-1')],
      nextCursor: null,
    } as never);
  });

  it('starts with no results', () => {
    const { result } = renderHook(() => useUserSearch());

    expect(result.current.results).toHaveLength(0);
  });

  it('searches by name or email and populates results', async () => {
    const { result } = renderHook(() => useUserSearch());

    await act(async (): Promise<void> => {
      await result.current.search('jane');
    });

    expect(usersApi.fetchAdminUsers).toHaveBeenCalledWith(5, null, 'jane');
    expect(result.current.results.map((user): string => user.id)).toEqual(['u-1']);
  });

  it('skips the request and clears results for an empty query', async () => {
    const { result } = renderHook(() => useUserSearch());

    await act(async (): Promise<void> => {
      await result.current.search('jane');
    });
    await act(async (): Promise<void> => {
      await result.current.search('');
    });

    expect(result.current.results).toHaveLength(0);
    expect(usersApi.fetchAdminUsers).toHaveBeenCalledTimes(1);
  });

  it('surfaces the error when the request fails', async () => {
    vi.mocked(usersApi.fetchAdminUsers).mockRejectedValue({
      statusCode: 500,
      code: 'INTERNAL',
      details: 'Something broke',
    });

    const { result } = renderHook(() => useUserSearch());

    await act(async (): Promise<void> => {
      await result.current.search('jane');
    });

    await waitFor((): void => expect(result.current.isLoading).toBe(false));

    expect(result.current.error?.code).toBe('INTERNAL');
  });

  it('clears results and error via clear', async () => {
    const { result } = renderHook(() => useUserSearch());

    await act(async (): Promise<void> => {
      await result.current.search('jane');
    });

    act(() => {
      result.current.clear();
    });

    expect(result.current.results).toHaveLength(0);
    expect(result.current.error).toBeNull();
  });
});
