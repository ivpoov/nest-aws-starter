import {
  activeSessionsCount,
  authMethodDistribution,
  newDevicesByDay,
  userRegistrationsByDay,
  usersByStatus,
} from '@generated/prisma/sql.js';
import { PrismaService } from '@modules/prisma/services/prisma.service.js';
import type { StatisticRepositoryInterface } from '@modules/statistic/interfaces/statistic-repository.interface.js';
import type { StatisticsCountRowInterface } from '@modules/statistic/interfaces/statistics-count-row.interface.js';
import type { StatisticsDayPointInterface } from '@modules/statistic/interfaces/statistics-day-point.interface.js';
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
