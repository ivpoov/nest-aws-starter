import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ThemeStoreInterface } from '../interfaces/theme-store.interface';
import type { ThemeModeType } from '../types/theme-mode.type';

export const useThemeStore = create<ThemeStoreInterface>()(
  persist(
    (set) => ({
      mode: (document.documentElement.dataset.theme as ThemeModeType | undefined) ?? 'dark',
      setMode: (mode: ThemeModeType): void => {
        document.documentElement.dataset.theme = mode;
        set({ mode });
      },
    }),
    { name: 'theme' },
  ),
);
