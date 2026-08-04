import type { ChangeEvent, ReactElement } from 'react';

interface InputPropsInterface {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly type?: 'text' | 'email' | 'password' | 'date' | 'number';
  readonly error?: string | null;
}

export function Input({
  label,
  value,
  onChange,
  type = 'text',
  error = null,
}: InputPropsInterface): ReactElement {
  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    onChange(event.target.value);
  }

  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-content-muted">{label}</span>
      <input
        type={type}
        value={value}
        onChange={handleChange}
        className="rounded-lg border border-edge bg-surface-raised px-3 py-2 text-content outline-none focus:border-accent"
      />
      {error ? <span className="text-danger">{error}</span> : null}
    </label>
  );
}
