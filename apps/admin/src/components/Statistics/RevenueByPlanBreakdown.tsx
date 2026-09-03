import type { ApiErrorInterface, StatisticsRevenueByPlanInterface } from '@nest-aws-starter/shared';
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
import { STATISTICS_REPORTING_CURRENCY } from '../../constants/statistics.constants';
import { useChartColors } from '../../hooks/statistics/useChartColors';
import type { ChartColorsInterface } from '../../interfaces/chart-colors.interface';
import { formatMoney } from '../../utils/formatMoney';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { ErrorMessage } from '../ui/ErrorMessage';
import { Loader } from '../ui/Loader';

// recharts reads its category axis straight off the row, so the null-plan
// row needs its display label resolved before the data reaches the chart.
interface ChartBarInterface {
  readonly label: string;
  readonly amountCents: number;
}

interface RevenueByPlanBreakdownPropsInterface {
  readonly items: StatisticsRevenueByPlanInterface[];
  readonly isLoading: boolean;
  readonly error: ApiErrorInterface | null;
  readonly onRetry: () => void;
}

function formatCents(amountCents: number): string {
  return formatMoney(amountCents, STATISTICS_REPORTING_CURRENCY);
}

function formatLabel(label: string | number | boolean | null | undefined): string {
  return typeof label === 'number' ? formatCents(label) : String(label ?? '');
}

// The API returns one row with a null plan: revenue from transactions that
// carry no subscription. Dropping it would put a breakdown on screen that
// does not add up to the total revenue tile beside it.
const UNATTRIBUTED_LABEL = 'Unattributed';

function planLabel(item: StatisticsRevenueByPlanInterface): string {
  return item.planName ?? UNATTRIBUTED_LABEL;
}

function planKey(item: StatisticsRevenueByPlanInterface): string {
  return item.planId ?? UNATTRIBUTED_LABEL;
}

// Same accessible-table companion pattern as AuthMethodBreakdown — recharts'
// SVG category ticks aren't something a unit test (or a screen reader)
// should have to depend on.
// `sr-only` goes on a wrapping div, NOT on the <table>. CSS table layout
// treats `height` as a MINIMUM, so a table ignores the 1px the utility sets and
// sizes to its content — and because the utility also makes it
// `position: absolute`, that full-height box still expands the document's
// scrollable area while being invisible. On the admin dashboard that put
// thousands of pixels of dead scroll under a page whose content ended at one
// screen. A div is a block box and honours the height, so the clipping works.
function renderAccessibleTable(items: StatisticsRevenueByPlanInterface[]): ReactElement {
  return (
    <div className="sr-only">
      <table>
        <caption>Revenue by plan (trailing 30 days)</caption>
        <thead>
          <tr>
            <th>Plan</th>
            <th>Revenue</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={planKey(item)}>
              <th scope="row">{planLabel(item)}</th>
              <td>{formatCents(item.amountCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderChart(
  items: StatisticsRevenueByPlanInterface[],
  colors: ChartColorsInterface,
): ReactElement {
  const bars: ChartBarInterface[] = items.map(
    (item: StatisticsRevenueByPlanInterface): ChartBarInterface => ({
      label: planLabel(item),
      amountCents: item.amountCents,
    }),
  );

  return (
    <>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart layout="vertical" data={bars}>
            <CartesianGrid horizontal={false} stroke={colors.edge} />
            <XAxis
              type="number"
              stroke={colors.muted}
              tick={{ fontSize: 12 }}
              tickFormatter={formatCents}
            />
            <YAxis
              type="category"
              dataKey="label"
              stroke={colors.muted}
              tick={{ fontSize: 12 }}
              width={80}
            />
            <Bar
              dataKey="amountCents"
              fill={colors.accent}
              radius={[0, 4, 4, 0]}
              isAnimationActive={false}
            >
              <LabelList
                dataKey="amountCents"
                position="right"
                fill={colors.muted}
                fontSize={12}
                formatter={formatLabel}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {renderAccessibleTable(items)}
    </>
  );
}

function renderBody(
  items: StatisticsRevenueByPlanInterface[],
  isLoading: boolean,
  error: ApiErrorInterface | null,
  onRetry: () => void,
  colors: ChartColorsInterface,
): ReactElement {
  if (error && items.length === 0) return <ErrorMessage error={error} onRetry={onRetry} />;
  if (isLoading && items.length === 0) return <Loader />;
  if (items.length === 0) return <EmptyState message="No plan revenue in the last 30 days" />;

  return (
    <div className="flex flex-col gap-3">
      {renderChart(items, colors)}
      {error ? <p className="text-sm text-danger">{error.details}</p> : null}
    </div>
  );
}

export function RevenueByPlanBreakdown({
  items,
  isLoading,
  error,
  onRetry,
}: RevenueByPlanBreakdownPropsInterface): ReactElement {
  const colors: ChartColorsInterface = useChartColors();

  return (
    <Card title="Revenue by plan">{renderBody(items, isLoading, error, onRetry, colors)}</Card>
  );
}
