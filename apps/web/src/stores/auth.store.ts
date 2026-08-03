import type { UserResponseInterface } from '@nest-aws-starter/shared';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthStoreInterface } from '../interfaces/auth-store.interface';

export const useAuthStore = create<AuthStoreInterface>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setTokens: (accessToken: string, refreshToken: string): void => {
        set({ accessToken, refreshToken });
      },
      setUser: (user: UserResponseInterface | null): void => {
        set({ user });
      },
      clear: (): void => {
        set({ accessToken: null, refreshToken: null, user: null });
      },
    }),
    { name: 'auth' },
  ),
);
