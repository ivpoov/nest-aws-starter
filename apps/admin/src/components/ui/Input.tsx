import { type ChangeEvent, type ReactElement, useId, useState } from 'react';

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
  const [isRevealed, setIsRevealed] = useState<boolean>(false);
  const errorId: string = useId();
  const isPassword: boolean = type === 'password';
  // Revealing swaps the input to `text`, which is the only way the browser
  // will render the characters — there is no "show" attribute on a password
  // field.
  const resolvedType: string = isPassword && isRevealed ? 'text' : type;
  // Revealing the characters is not enough on its own: a leading or trailing
  // tab, space or newline renders as nothing at all, so a pasted credential
  // that carries one looks identical to a correct one even unmasked. The only
  // feedback is "invalid credentials", which reads as "this account does not
  // exist" — and the reasonable next move is to re-seed the database, which is
  // exactly the wrong one.
  //
  // Said rather than stripped: silently trimming would change what the user
  // typed, and a password legitimately ending in a space would then be
  // unenterable with no way to find out why.
  const hasEdgeWhitespace: boolean = isPassword && value !== value.trim() && value.length > 0;

  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    onChange(event.target.value);
  }

  return (
    // The error sits OUTSIDE the <label>. Inside it, its text joins the field's
    // accessible name — a screen reader would announce "Password Too short" as
    // the name and then "Too short" again as the description. Outside, the label
    // names the field and aria-describedby carries the error, which is the split
    // those two attributes exist for.
    <div className="flex flex-col gap-1 text-sm">
      <label className="flex flex-col gap-1">
        <span className="text-content-muted">{label}</span>
        <span className="relative flex">
          <input
            type={resolvedType}
            value={value}
            onChange={handleChange}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className={`w-full rounded-lg border border-edge bg-surface-raised py-2 pl-3 text-content outline-none focus:border-accent ${
              isPassword ? 'pr-16' : 'pr-3'
            }`}
          />
          {isPassword ? (
            // `type="button"`, or it submits the form it sits in — which on a
            // login page means an attempt with whatever is typed so far.
            <button
              type="button"
              onClick={(): void => setIsRevealed((current: boolean): boolean => !current)}
              aria-pressed={isRevealed}
              aria-label={isRevealed ? 'Hide password' : 'Show password'}
              className="absolute inset-y-0 right-0 px-3 text-xs text-content-muted hover:text-content"
            >
              {isRevealed ? 'Hide' : 'Show'}
            </button>
          ) : null}
        </span>
      </label>
      {hasEdgeWhitespace ? (
        <span className="text-content-muted">
          This starts or ends with a space or tab — check for stray characters if it was pasted.
        </span>
      ) : null}
      {error ? (
        <span id={errorId} className="text-danger">
          {error}
        </span>
      ) : null}
    </div>
  );
}
