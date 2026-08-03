import type { ReactElement } from 'react';
import { SessionList } from '../components/Sessions/SessionList';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import { Loader } from '../components/ui/Loader';
import { useSessions } from '../hooks/sessions/useSessions';

export function SessionsPage(): ReactElement {
  const { sessions, isLoading, error, revoke, revokeOthers } = useSessions();

  if (isLoading && sessions.length === 0) return <Loader />;
  if (error && sessions.length === 0) return <ErrorMessage error={error} />;

  return (
    <Card title="Active sessions">
      <SessionList sessions={sessions} onRevoke={(id): void => void revoke(id)} />
      {sessions.length > 1 ? (
        <div className="mt-4">
          <Button variant="ghost" onClick={(): void => void revokeOthers()}>
            Log out other sessions
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
