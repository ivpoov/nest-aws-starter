import type { SessionResponseInterface } from '@nest-aws-starter/shared';
import type { ReactElement } from 'react';
import { Button } from '../ui/Button';

interface SessionListPropsInterface {
  readonly sessions: SessionResponseInterface[];
  readonly onRevoke: (id: string) => void;
}

export function SessionList({ sessions, onRevoke }: SessionListPropsInterface): ReactElement {
  return (
    <ul className="flex flex-col gap-3">
      {sessions.map((session: SessionResponseInterface) => (
        <li
          key={session.id}
          className="flex items-center justify-between rounded-lg border border-edge p-3 text-sm"
        >
          <div className="flex flex-col">
            <span className="font-medium">
              {session.device}
              {session.isCurrent ? ' — this device' : ''}
            </span>
            <span className="text-content-muted">
              {session.ip} · active {new Date(session.lastActiveAt).toLocaleString()}
            </span>
          </div>
          {session.isCurrent ? null : (
            <Button variant="ghost" onClick={(): void => onRevoke(session.id)}>
              Revoke
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
