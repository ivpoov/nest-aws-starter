import { ContactMessageStatusEnum } from '@nest-aws-starter/shared';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as contactApi from '../apis/contact';
import { useContactMessages } from '../hooks/contact/useContactMessages';

vi.mock('../apis/contact');

function contactMessage(id: string): Record<string, unknown> {
  return {
    id,
    name: 'Jane Doe',
    email: 'jane@example.com',
    subject: `Subject ${id}`,
    body: 'Body text',
    status: 'OPEN',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  };
}

describe('useContactMessages', () => {
  beforeEach(() => {
    vi.mocked(contactApi.fetchContactMessages).mockResolvedValue({
      items: [contactMessage('m-1')],
      nextCursor: 'm-1',
    } as never);
  });

  it('loads the first page and reports more', async () => {
    const { result } = renderHook(() => useContactMessages(null));

    await waitFor((): void => expect(result.current.isLoading).toBe(false));

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.hasMore).toBe(true);
  });

  it('appends the next page through the cursor', async () => {
    const { result } = renderHook(() => useContactMessages(null));

    await waitFor((): void => expect(result.current.isLoading).toBe(false));

    vi.mocked(contactApi.fetchContactMessages).mockResolvedValue({
      items: [contactMessage('m-2')],
      nextCursor: null,
    } as never);

    await act(async (): Promise<void> => {
      await result.current.loadMore();
    });

    expect(contactApi.fetchContactMessages).toHaveBeenLastCalledWith(20, 'm-1', null);
    expect(result.current.messages.map((message): string => message.id)).toEqual(['m-1', 'm-2']);
    expect(result.current.hasMore).toBe(false);
  });

  it('restarts from a fresh page when the status filter changes', async () => {
    const initialProps: { status: ContactMessageStatusEnum | null } = { status: null };
    const { result, rerender } = renderHook(
      ({ status }: { status: ContactMessageStatusEnum | null }) => useContactMessages(status),
      { initialProps },
    );

    await waitFor((): void => expect(result.current.isLoading).toBe(false));

    rerender({ status: ContactMessageStatusEnum.RESOLVED });

    await waitFor((): void => {
      expect(contactApi.fetchContactMessages).toHaveBeenLastCalledWith(
        20,
        null,
        ContactMessageStatusEnum.RESOLVED,
      );
    });
  });

  it('reload refetches the first page, discarding any loaded-more pages', async () => {
    const { result } = renderHook(() => useContactMessages(null));

    await waitFor((): void => expect(result.current.isLoading).toBe(false));

    vi.mocked(contactApi.fetchContactMessages).mockResolvedValue({
      items: [contactMessage('m-3')],
      nextCursor: null,
    } as never);

    await act(async (): Promise<void> => {
      await result.current.reload();
    });

    expect(contactApi.fetchContactMessages).toHaveBeenLastCalledWith(20, null, null);
    expect(result.current.messages.map((message): string => message.id)).toEqual(['m-3']);
  });
});
