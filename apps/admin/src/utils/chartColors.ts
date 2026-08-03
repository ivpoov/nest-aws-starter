import type { ChartColorsInterface } from '../interfaces/chart-colors.interface';

// Fallbacks mirror the light-mode tokens in styles/global.css — used only if
// getComputedStyle can't resolve a custom property (e.g. non-DOM test runner).
const FALLBACKS: ChartColorsInterface = {
  accent: 'oklch(0.55 0.2 262)',
  muted: 'oklch(0.52 0.02 262)',
  edge: 'oklch(0.9 0.01 262)',
  danger: 'oklch(0.55 0.2 27)',
};

function readToken(styles: CSSStyleDeclaration, name: string, fallback: string): string {
  const value: string = styles.getPropertyValue(name).trim();

  return value === '' ? fallback : value;
}

// Reads the semantic theme tokens at render time so recharts strokes/fills track
// the active theme (light/dark) without any hardcoded hex values.
export function getChartColors(): ChartColorsInterface {
  const styles: CSSStyleDeclaration = getComputedStyle(document.documentElement);

  return {
    accent: readToken(styles, '--accent', FALLBACKS.accent),
    muted: readToken(styles, '--content-muted', FALLBACKS.muted),
    edge: readToken(styles, '--edge', FALLBACKS.edge),
    danger: readToken(styles, '--danger', FALLBACKS.danger),
  };
}
