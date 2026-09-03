import type {
  ApiErrorInterface,
  StatisticsCountBreakdownInterface,
} from '@nest-aws-starter/shared';
import type { ReactElement } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts';
import { useChartColors } from '../../hooks/statistics/useChartColors';
import type { ChartColorsInterface } from '../../interfaces/chart-colors.interface';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { ErrorMessage } from '../ui/ErrorMessage';
import { Loader } from '../ui/Loader';

interface AuthMethodBreakdownPropsInterface {
  readonly items: StatisticsCountBreakdownInterface[];
  readonly isLoading: boolean;
  readonly error: ApiErrorInterface | null;
  readonly onRetry: () => void;
}

// A visually-hidden data table alongside the chart — screen readers and
// tests get the real values without depending on SVG text metrics, which
// jsdom doesn't implement (recharts' category ticks render, but their exact
// layout is not something a unit test should assert against).
// `sr-only` goes on a wrapping div, NOT on the <table>. CSS table layout
// treats `height` as a MINIMUM, so a table ignores the 1px the utility sets and
// sizes to its content — and because the utility also makes it
// `position: absolute`, that full-height box still expands the document's
// scrollable area while being invisible. On the admin dashboard that put
// thousands of pixels of dead scroll under a page whose content ended at one
// screen. A div is a block box and honours the height, so the clipping works.
function renderAccessibleTable(items: StatisticsCountBreakdownInterface[]): ReactElement {
  return (
    <div className="sr-only">
      <table>
        <caption>Auth methods by count</caption>
        <thead>
          <tr>
            <th>Method</th>
            <th>Count</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.key}>
              <th scope="row">{item.key}</th>
              <td>{item.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// One measure (count) split across nominal categories — a single hue carries
// the bars; the axis labels already give identity, so no per-bar color.
function renderChart(
  items: StatisticsCountBreakdownInterface[],
  colors: ChartColorsInterface,
): ReactElement {
  return (
    <>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart layout="vertical" data={items}>
            <CartesianGrid horizontal={false} stroke={colors.edge} />
            <XAxis
              type="number"
              stroke={colors.muted}
              tick={{ fontSize: 12 }}
              allowDecimals={false}
            />
            <YAxis
              type="category"
              dataKey="key"
              stroke={colors.muted}
              tick={{ fontSize: 12 }}
              width={80}
            />
            <Bar
              dataKey="count"
              fill={colors.accent}
              radius={[0, 4, 4, 0]}
              isAnimationActive={false}
            >
              <LabelList dataKey="count" position="right" fill={colors.muted} fontSize={12} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {renderAccessibleTable(items)}
    </>
  );
}

function renderBody(
  items: StatisticsCountBreakdownInterface[],
  isLoading: boolean,
  error: ApiErrorInterface | null,
  onRetry: () => void,
  colors: ChartColorsInterface,
): ReactElement {
  if (error && items.length === 0) return <ErrorMessage error={error} onRetry={onRetry} />;
  if (isLoading && items.length === 0) return <Loader />;
  if (items.length === 0) return <EmptyState message="No auth methods yet" />;

  return (
    <div className="flex flex-col gap-3">
      {renderChart(items, colors)}
      {error ? <p className="text-sm text-danger">{error.details}</p> : null}
    </div>
  );
}

export function AuthMethodBreakdown({
  items,
  isLoading,
  error,
  onRetry,
}: AuthMethodBreakdownPropsInterface): ReactElement {
  const colors: ChartColorsInterface = useChartColors();

  return <Card title="Auth methods">{renderBody(items, isLoading, error, onRetry, colors)}</Card>;
}
