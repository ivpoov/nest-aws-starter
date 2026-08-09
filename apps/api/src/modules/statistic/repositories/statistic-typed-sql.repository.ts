import {
  activeSessionsCount,
  authMethodDistribution,
  mrrCurrent, // <module:payment>
  newDevicesByDay,
  revenueByDay, // <module:payment>
  revenueByPlan, // <module:payment>
  userRegistrationsByDay,
  usersByStatus,
} from '@generated/prisma/sql.js';
import { PrismaService } from '@modules/prisma/services/prisma.service.js';
// <module:payment>
import { STATISTIC_REPORTING_CURRENCY } from '@modules/statistic/constants/statistic-revenue.constants.js';
// </module:payment>
import type { StatisticRepositoryInterface } from '@modules/statistic/interfaces/statistic-repository.interface.js';
import type { StatisticsCountRowInterface } from '@modules/statistic/interfaces/statistics-count-row.interface.js';
import type { StatisticsDayPointInterface } from '@modules/statistic/interfaces/statistics-day-point.interface.js';
// <module:payment>
import type { StatisticsRevenueByPlanRowInterface } from '@modules/statistic/interfaces/statistics-revenue-by-plan-row.interface.js';
// </module:payment>
import { Injectable } from '@nestjs/common';

@Injectable()
export class StatisticTypedSqlRepository implements StatisticRepositoryInterface {
  constructor(private readonly prisma: PrismaService) {}

  public async findUsersByStatus(): Promise<StatisticsCountRowInterface[]> {
    const rows: usersByStatus.Result[] = await this.prisma.$queryRawTyped(usersByStatus());

    return rows.map(
      (row: usersByStatus.Result): StatisticsCountRowInterface => ({
        key: row.status ?? 'UNKNOWN',
        count: row.count ?? 0,
      }),
    );
  }

  public async findAuthMethodDistribution(): Promise<StatisticsCountRowInterface[]> {
    const rows: authMethodDistribution.Result[] = await this.prisma.$queryRawTyped(
      authMethodDistribution(),
    );

    return rows.map(
      (row: authMethodDistribution.Result): StatisticsCountRowInterface => ({
        key: row.type ?? 'UNKNOWN',
        count: row.count ?? 0,
      }),
    );
  }

  public async countActiveSessions(): Promise<number> {
    const rows: activeSessionsCount.Result[] = await this.prisma.$queryRawTyped(
      activeSessionsCount(),
    );

    return rows[0]?.count ?? 0;
  }

  public async findRegistrationsByDay(days: number): Promise<StatisticsDayPointInterface[]> {
    const rows: userRegistrationsByDay.Result[] = await this.prisma.$queryRawTyped(
      userRegistrationsByDay(days),
    );

    return rows.map(
      (row: userRegistrationsByDay.Result): StatisticsDayPointInterface => this.toDayPoint(row),
    );
  }

  public async findNewDevicesByDay(days: number): Promise<StatisticsDayPointInterface[]> {
    const rows: newDevicesByDay.Result[] = await this.prisma.$queryRawTyped(newDevicesByDay(days));

    return rows.map(
      (row: newDevicesByDay.Result): StatisticsDayPointInterface => this.toDayPoint(row),
    );
  }

  // <module:payment>
  public async findRevenueByDay(days: number): Promise<StatisticsDayPointInterface[]> {
    const rows: revenueByDay.Result[] = await this.prisma.$queryRawTyped(
      revenueByDay(days, STATISTIC_REPORTING_CURRENCY),
    );

    return rows.map(
      (row: revenueByDay.Result): StatisticsDayPointInterface =>
        this.toDayPoint({ day: row.day, count: this.toCents(row.amountCents) }),
    );
  }

  public async findMrrCents(): Promise<number> {
    const rows: mrrCurrent.Result[] = await this.prisma.$queryRawTyped(
      mrrCurrent(STATISTIC_REPORTING_CURRENCY),
    );

    return this.toCents(rows[0]?.mrrCents ?? 0n);
  }

  public async findRevenueByPlan(days: number): Promise<StatisticsRevenueByPlanRowInterface[]> {
    const rows: revenueByPlan.Result[] = await this.prisma.$queryRawTyped(
      revenueByPlan(days, STATISTIC_REPORTING_CURRENCY),
    );

    return rows.map(
      (row: revenueByPlan.Result): StatisticsRevenueByPlanRowInterface => ({
        planId: row.planId,
        planName: row.planName,
        amountCents: this.toCents(row.amountCents),
      }),
    );
  }

  // The revenue queries aggregate into bigint (see revenueByDay.sql) because
  // int32 would make Postgres raise `integer out of range` past ~$21.5M per
  // bucket. JSON has no bigint, so the wire contract stays `number` — safe up
  // to Number.MAX_SAFE_INTEGER cents (~$90T), four million times the int32
  // ceiling this replaced. Beyond that the value is clamped rather than
  // silently rounded, so a wrong number never reaches an admin unnoticed.
  private toCents(value: bigint | null): number {
    if (value === null) return 0;

    const ceiling: bigint = BigInt(Number.MAX_SAFE_INTEGER);

    if (value > ceiling) return Number.MAX_SAFE_INTEGER;
    if (value < -ceiling) return -Number.MAX_SAFE_INTEGER;

    return Number(value);
  }
  // </module:payment>

  private toDayPoint(row: {
    readonly day: Date | null;
    readonly count: number | null;
  }): StatisticsDayPointInterface {
    const date: Date = row.day ?? new Date();

    return {
      date: date.toISOString().slice(0, 10),
      count: row.count ?? 0,
    };
  }
}
