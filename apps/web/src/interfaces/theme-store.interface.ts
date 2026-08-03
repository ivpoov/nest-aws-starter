import type { ThemeModeType } from '../types/theme-mode.type';

export interface ThemeStoreInterface {
  readonly mode: ThemeModeType;
  readonly setMode: (mode: ThemeModeType) => void;
}
