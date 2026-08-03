import { useMemo } from 'react';
import type { ChartColorsInterface } from '../../interfaces/chart-colors.interface';
import { useThemeStore } from '../../stores/theme.store';
import type { ThemeModeType } from '../../types/theme-mode.type';
import { getChartColors } from '../../utils/chartColors';

// Re-reads the CSS custom properties whenever the theme mode changes, so a
// mounted chart's stroke/fill tracks a live in-session theme toggle instead
// of keeping the colors it happened to read on first render.
export function useChartColors(): ChartColorsInterface {
  const mode: ThemeModeType = useThemeStore((state) => state.mode);

  // biome-ignore lint/correctness/useExhaustiveDependencies: mode is a deliberate recompute key, not read inside getChartColors()
  return useMemo((): ChartColorsInterface => getChartColors(), [mode]);
}
