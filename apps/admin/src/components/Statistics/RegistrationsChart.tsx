import type { ApiErrorInterface, StatisticsSeriesPointInterface } from '@nest-aws-starter/shared';
import type { ReactElement } from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ChartColorsInterface } from '../../interfaces/chart-colors.interface';
import { getChartColors } from '../../utils/chartColors';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { ErrorMessage } from '../ui/ErrorMessage';
import { Loader } from '../ui/Loader';

const DAY_OPTIONS: readonly number[] = [7, 30, 90];

interface RegistrationsChartPropsInterface {
  readonly points: StatisticsSeriesPointInterface[];
  readonly isLoading: boolean;
  readonly error: ApiErrorInterface | null;
  readonly days: number;
  readonly onDaysChange: (days: number) => void;
  readonly onRetry: () => void;
}

function renderChart(
  points: StatisticsSeriesPointInterface[],
  colors: ChartColorsInterface,
): ReactElement {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points}>
          <XAxis dataKey="date" stroke={colors.muted} tick={{ fontSize: 12 }} />
          <YAxis stroke={colors.muted} tick={{ fontSize: 12 }} allowDecimals={false} />
          <Tooltip contentStyle={{ background: colors.edge, border: 'none' }} />
          <Line
            type="monotone"
            dataKey="value"
            stroke={colors.accent}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function renderBody(
  points: StatisticsSeriesPointInterface[],
  isLoading: boolean,
  error: ApiErrorInterface | null,
  onRetry: () => void,
  colors: ChartColorsInterface,
): ReactElement {
  if (error && points.length === 0) return <ErrorMessage error={error} onRetry={onRetry} />;
  if (isLoading && points.length === 0) return <Loader />;
  if (points.length === 0) return <EmptyState message="No registrations in this range" />;

  return renderChart(points, colors);
}

export function RegistrationsChart({
  points,
  isLoading,
  error,
  days,
  onDaysChange,
  onRetry,
}: RegistrationsChartPropsInterface): ReactElement {
  const colors: ChartColorsInterface = getChartColors();

  return (
    <Card title="Registrations">
      <div className="mb-4 flex gap-2">
        {DAY_OPTIONS.map(
          (option): ReactElement => (
            <Button
              key={option}
              variant={option === days ? 'primary' : 'ghost'}
              onClick={(): void => onDaysChange(option)}
            >
              {option}d
            </Button>
          ),
        )}
      </div>
      {renderBody(points, isLoading, error, onRetry, colors)}
    </Card>
  );
}
