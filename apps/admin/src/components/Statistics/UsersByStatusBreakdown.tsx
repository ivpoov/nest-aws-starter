import type {
  ApiErrorInterface,
  StatisticsCountBreakdownInterface,
} from '@nest-aws-starter/shared';
import { UserStatusEnum } from '@nest-aws-starter/shared';
import type { ReactElement } from 'react';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { ErrorMessage } from '../ui/ErrorMessage';
import { Loader } from '../ui/Loader';

interface UsersByStatusBreakdownPropsInterface {
  readonly items: StatisticsCountBreakdownInterface[];
  readonly isLoading: boolean;
  readonly error: ApiErrorInterface | null;
  readonly onRetry: () => void;
}

function statusTone(key: string): 'neutral' | 'negative' {
  return key === UserStatusEnum.BLOCKED ? 'negative' : 'neutral';
}

function renderList(items: StatisticsCountBreakdownInterface[]): ReactElement {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item.key} className="flex items-center justify-between text-sm">
          <Badge label={item.key} tone={statusTone(item.key)} />
          <span className="font-medium">{item.count.toLocaleString()}</span>
        </li>
      ))}
    </ul>
  );
}

function renderBody(
  items: StatisticsCountBreakdownInterface[],
  isLoading: boolean,
  error: ApiErrorInterface | null,
  onRetry: () => void,
): ReactElement {
  if (error && items.length === 0) return <ErrorMessage error={error} onRetry={onRetry} />;
  if (isLoading && items.length === 0) return <Loader />;
  if (items.length === 0) return <EmptyState message="No users yet" />;

  return renderList(items);
}

export function UsersByStatusBreakdown({
  items,
  isLoading,
  error,
  onRetry,
}: UsersByStatusBreakdownPropsInterface): ReactElement {
  return <Card title="Users by status">{renderBody(items, isLoading, error, onRetry)}</Card>;
}
