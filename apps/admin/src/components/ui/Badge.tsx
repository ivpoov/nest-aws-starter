import type { ReactElement } from 'react';

interface BadgePropsInterface {
  readonly label: string;
  readonly tone?: 'neutral' | 'positive' | 'negative';
}

const TONE_CLASSES: Record<string, string> = {
  neutral: 'border-edge text-content-muted',
  positive: 'border-accent text-accent',
  negative: 'border-danger text-danger',
};

export function Badge({ label, tone = 'neutral' }: BadgePropsInterface): ReactElement {
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs ${TONE_CLASSES[tone]}`}>{label}</span>
  );
}
