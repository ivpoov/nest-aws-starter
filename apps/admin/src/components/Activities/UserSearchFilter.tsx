import type { AdminUserResponseInterface } from '@nest-aws-starter/shared';
import type { ReactElement } from 'react';
import { useRef, useState } from 'react';
import { useUserSearch } from '../../hooks/users/useUserSearch';
import { Input } from '../ui/Input';

interface UserSearchFilterPropsInterface {
  readonly selectedUserLabel: string | null;
  readonly onSelectUser: (userId: string, label: string) => void;
  readonly onClearUser: () => void;
}

const DEBOUNCE_MS = 250;

function userLabel(user: AdminUserResponseInterface): string {
  return user.email ? `${user.displayName} (${user.email})` : user.displayName;
}

export function UserSearchFilter({
  selectedUserLabel,
  onSelectUser,
  onClearUser,
}: UserSearchFilterPropsInterface): ReactElement {
  const [query, setQuery] = useState<string>('');
  const { results, search, clear } = useUserSearch();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleQueryChange(value: string): void {
    setQuery(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout((): void => {
      void search(value);
    }, DEBOUNCE_MS);
  }

  function handleSelect(user: AdminUserResponseInterface): void {
    onSelectUser(user.id, userLabel(user));
    setQuery('');
    clear();
  }

  function handleClearClick(): void {
    onClearUser();
    setQuery('');
    clear();
  }

  if (selectedUserLabel) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-sm text-content-muted">User</span>
        <span className="flex items-center gap-2 rounded-full border border-accent px-3 py-1.5 text-xs text-accent">
          Filtering by {selectedUserLabel}
          <button
            type="button"
            onClick={handleClearClick}
            className="text-content-muted hover:text-content"
          >
            Clear
          </button>
        </span>
      </div>
    );
  }

  return (
    <div className="relative flex max-w-xs grow flex-col gap-1">
      <Input label="Search users by name or email" value={query} onChange={handleQueryChange} />
      {results.length > 0 ? (
        <ul className="absolute top-full z-10 mt-1 w-full rounded-lg border border-edge bg-surface-raised shadow-sm">
          {results.map(
            (user): ReactElement => (
              <li key={user.id}>
                <button
                  type="button"
                  onClick={(): void => handleSelect(user)}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-surface"
                >
                  {userLabel(user)}
                </button>
              </li>
            ),
          )}
        </ul>
      ) : null}
    </div>
  );
}
