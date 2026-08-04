import { ContactMessageStatusEnum } from '@nest-aws-starter/shared';
import type { ReactElement } from 'react';

interface ContactStatusFilterPropsInterface {
  readonly status: ContactMessageStatusEnum | null;
  readonly onChange: (status: ContactMessageStatusEnum | null) => void;
}

const STATUS_OPTIONS: ContactMessageStatusEnum[] = Object.values(ContactMessageStatusEnum);

function chipClassName(isActive: boolean): string {
  return isActive
    ? 'rounded-full bg-accent px-3 py-1 text-xs text-accent-content'
    : 'rounded-full border border-edge px-3 py-1 text-xs text-content-muted hover:text-content';
}

export function ContactStatusFilter({
  status,
  onChange,
}: ContactStatusFilterPropsInterface): ReactElement {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={(): void => onChange(null)}
        className={chipClassName(status === null)}
      >
        All
      </button>
      {STATUS_OPTIONS.map(
        (option): ReactElement => (
          <button
            key={option}
            type="button"
            onClick={(): void => onChange(option)}
            className={chipClassName(status === option)}
          >
            {option}
          </button>
        ),
      )}
    </div>
  );
}
