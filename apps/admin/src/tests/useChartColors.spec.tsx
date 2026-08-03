import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useChartColors } from '../hooks/statistics/useChartColors';
import { useThemeStore } from '../stores/theme.store';

const LIGHT_ACCENT = 'oklch(0.55 0.2 262)';
const DARK_ACCENT = 'oklch(0.68 0.16 262)';

function accentForMode(mode: string): string {
  return mode === 'dark' ? DARK_ACCENT : LIGHT_ACCENT;
}

describe('useChartColors', () => {
  beforeEach(() => {
    vi.spyOn(window, 'getComputedStyle').mockImplementation(
      (element: Element): CSSStyleDeclaration => {
        const mode: string = (element as HTMLElement).dataset.theme ?? 'light';

        return {
          getPropertyValue: (name: string): string =>
            name === '--accent' ? accentForMode(mode) : '',
        } as CSSStyleDeclaration;
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete document.documentElement.dataset.theme;
  });

  it('recomputes colors when the theme mode changes', () => {
    document.documentElement.dataset.theme = 'light';
    useThemeStore.setState({ mode: 'light' });

    const { result } = renderHook(() => useChartColors());

    expect(result.current.accent).toBe(LIGHT_ACCENT);

    act((): void => {
      document.documentElement.dataset.theme = 'dark';
      useThemeStore.setState({ mode: 'dark' });
    });

    expect(result.current.accent).toBe(DARK_ACCENT);
  });
});
