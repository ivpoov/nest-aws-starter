import type { ApiErrorInterface, StatisticsSeriesPointInterface } from '@nest-aws-starter/shared';
import type { ReactElement } from 'react';
import type { TooltipValueType } from 'recharts';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { STATISTICS_REPORTING_CURRENCY } from '../../constants/statistics.constants';
import { useChartColors } from '../../hooks/statistics/useChartColors';
import type { ChartColorsInterface } from '../../interfaces/chart-colors.interface';
import { formatMoney } from '../../utils/formatMoney';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { ErrorMessage } from '../ui/ErrorMessage';
import { Loader } from '../ui/Loader';

const DAY_OPTIONS: readonly number[] = [7, 30, 90];

interface RevenueChartPropsInterface {
  readonly points: StatisticsSeriesPointInterface[];
  readonly isLoading: boolean;
  readonly error: ApiErrorInterface | null;
  readonly days: number;
  readonly onDaysChange: (days: number) => void;
  readonly onRetry: () => void;
}

function formatCents(amountCents: number): string {
  return formatMoney(amountCents, STATISTICS_REPORTING_CURRENCY);
}

function formatTooltipValue(value: TooltipValueType | undefined): string {
  return typeof value === 'number' ? formatCents(value) : String(value ?? '');
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
          <YAxis
            stroke={colors.muted}
            tick={{ fontSize: 12 }}
            allowDecimals={false}
            tickFormatter={formatCents}
            width={80}
          />
          <Tooltip
            contentStyle={{ background: colors.edge, border: 'none' }}
            formatter={formatTooltipValue}
          />
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
  if (points.length === 0) return <EmptyState message="No revenue in this range" />;

  return (
    <div className="flex flex-col gap-3">
      {renderChart(points, colors)}
      {error ? <p className="text-sm text-danger">{error.details}</p> : null}
    </div>
  );
}

export function RevenueChart({
  points,
  isLoading,
  error,
  days,
  onDaysChange,
  onRetry,
}: RevenueChartPropsInterface): ReactElement {
  const colors: ChartColorsInterface = useChartColors();

  return (
    <Card title="Revenue">
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
