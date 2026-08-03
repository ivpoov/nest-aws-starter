import { beforeEach, describe, expect, it } from 'vitest';
import { useAuthStore } from '../stores/auth.store';

describe('auth store', () => {
  beforeEach(() => {
    useAuthStore.getState().clear();
    localStorage.clear();
  });

  it('stores tokens and clears everything on logout', () => {
    useAuthStore.getState().setTokens('a', 'r');

    expect(useAuthStore.getState().accessToken).toBe('a');

    useAuthStore.getState().clear();

    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().refreshToken).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('persists tokens into localStorage', () => {
    useAuthStore.getState().setTokens('persist-me', 'r');

    const raw: string | null = localStorage.getItem('auth');

    expect(raw).toContain('persist-me');
  });
});
