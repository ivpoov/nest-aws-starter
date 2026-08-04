import type { ChangeEvent, ReactElement } from 'react';

interface TextareaPropsInterface {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly maxLength?: number;
  readonly error?: string | null;
}

export function Textarea({
  label,
  value,
  onChange,
  maxLength,
  error = null,
}: TextareaPropsInterface): ReactElement {
  function handleChange(event: ChangeEvent<HTMLTextAreaElement>): void {
    onChange(event.target.value);
  }

  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-content-muted">{label}</span>
      <textarea
        value={value}
        onChange={handleChange}
        maxLength={maxLength}
        rows={5}
        className="rounded-lg border border-edge bg-surface-raised px-3 py-2 text-content outline-none focus:border-accent"
      />
      {error ? <span className="text-danger">{error}</span> : null}
    </label>
  );
}
