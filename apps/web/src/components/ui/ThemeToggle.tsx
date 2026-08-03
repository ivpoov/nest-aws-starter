import type { ReactElement } from 'react';
import { useThemeStore } from '../../stores/theme.store';
import type { ThemeModeType } from '../../types/theme-mode.type';

export function ThemeToggle(): ReactElement {
  const mode: ThemeModeType = useThemeStore((state) => state.mode);
  const setMode = useThemeStore((state) => state.setMode);

  function handleToggle(): void {
    setMode(mode === 'dark' ? 'light' : 'dark');
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label="Toggle theme"
      className="rounded-lg border border-edge px-3 py-1.5 text-sm hover:bg-surface"
    >
      {mode === 'dark' ? 'Light' : 'Dark'}
    </button>
  );
}
