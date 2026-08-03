import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as methodsApi from '../apis/methods';
import { useLinkedMethods } from '../hooks/methods/useLinkedMethods';

vi.mock('../apis/methods');

const emailMethod = {
  type: 'EMAIL',
  email: 'igor@example.com',
  isEmailVerified: true,
  createdAt: '2026-08-01T00:00:00.000Z',
  lastUsedAt: null,
};

describe('useLinkedMethods', () => {
  beforeEach(() => {
    vi.mocked(methodsApi.fetchMethods).mockResolvedValue({ methods: [emailMethod] } as never);
  });

  it('loads methods on mount', async () => {
    const { result } = renderHook(() => useLinkedMethods());

    await waitFor((): void => expect(result.current.isLoading).toBe(false));

    expect(result.current.methods).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it('surfaces the conflict envelope from addEmail and keeps the list', async () => {
    vi.mocked(methodsApi.addEmailMethod).mockRejectedValue({
      statusCode: 409,
      code: 'AUTH_EMAIL_LINKED_TO_OTHER_ACCOUNT',
      details: 'linked elsewhere',
      meta: { providers: ['GOOGLE'] },
    });

    const { result } = renderHook(() => useLinkedMethods());

    await waitFor((): void => expect(result.current.isLoading).toBe(false));

    let isAdded = true;

    await act(async (): Promise<void> => {
      isAdded = await result.current.addEmail({ email: 'x@example.com', password: 'password-1' });
    });

    expect(isAdded).toBe(false);
    expect(result.current.error?.code).toBe('AUTH_EMAIL_LINKED_TO_OTHER_ACCOUNT');
    expect(result.current.methods).toHaveLength(1);
  });

  it('reloads after a successful unlink', async () => {
    vi.mocked(methodsApi.unlinkMethod).mockResolvedValue(undefined);

    const { result } = renderHook(() => useLinkedMethods());

    await waitFor((): void => expect(result.current.isLoading).toBe(false));

    await act(async (): Promise<void> => {
      await result.current.unlink('GOOGLE');
    });

    expect(methodsApi.unlinkMethod).toHaveBeenCalledWith('GOOGLE');
    expect(vi.mocked(methodsApi.fetchMethods).mock.calls.length).toBeGreaterThan(1);
  });
});
