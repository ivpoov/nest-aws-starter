import type { ReactElement, ReactNode } from 'react';

interface ButtonPropsInterface {
  readonly children: ReactNode;
  readonly type?: 'button' | 'submit';
  readonly variant?: 'primary' | 'ghost' | 'danger';
  readonly isDisabled?: boolean;
  readonly onClick?: () => void;
}

const VARIANT_CLASSES: Record<string, string> = {
  primary: 'bg-accent text-accent-content hover:opacity-90',
  ghost: 'border border-edge text-content hover:bg-surface',
  danger: 'bg-danger text-accent-content hover:opacity-90',
};

export function Button({
  children,
  type = 'button',
  variant = 'primary',
  isDisabled = false,
  onClick,
}: ButtonPropsInterface): ReactElement {
  return (
    <button
      type={type}
      disabled={isDisabled}
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${VARIANT_CLASSES[variant]}`}
    >
      {children}
    </button>
  );
}
