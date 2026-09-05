import type { Prisma } from '@generated/prisma/client.js';
import { ActivityType } from '@generated/prisma/enums.js';
import type { ActivityModel } from '@generated/prisma/models.js';
import type { CursorPaginationInterface } from '@interfaces/cursor-pagination.interface.js';
import type { ActivityInterface } from '@modules/activity/interfaces/activity.interface.js';
import type { ActivityFiltersInterface } from '@modules/activity/interfaces/activity-filters.interface.js';
import type { ActivityRepositoryInterface } from '@modules/activity/interfaces/activity-repository.interface.js';
import type { CreateActivityDataInterface } from '@modules/activity/interfaces/create-activity-data.interface.js';
import { PrismaService } from '@modules/prisma/services/prisma.service.js';
import { ActivityTypeEnum } from '@nest-aws-starter/shared';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ActivityPrismaRepository implements ActivityRepositoryInterface {
  constructor(private readonly prisma: PrismaService) {}

  public async create(data: CreateActivityDataInterface): Promise<ActivityInterface> {
    const activity: ActivityModel = await this.prisma.activity.create({
      data: {
        userId: data.userId ?? null,
        actorId: data.actorId ?? null,
        sessionId: data.sessionId ?? null,
        type: ActivityType[data.type],
        meta: (data.meta ?? undefined) as Prisma.InputJsonValue | undefined,
        ip: data.ip ?? null,
      },
    });

    return this.toDomain(activity);
  }

  public async findManyAfter(
    pagination: CursorPaginationInterface,
    filters: ActivityFiltersInterface,
  ): Promise<ActivityInterface[]> {
    const activities: ActivityModel[] = await this.prisma.activity.findMany({
      where: {
        ...(filters.userId && { userId: filters.userId }),
        ...(filters.type && { type: ActivityType[filters.type] }),
        ...((filters.dateFrom || filters.dateTo) && {
          createdAt: {
            ...(filters.dateFrom && { gte: filters.dateFrom }),
            ...(filters.dateTo && { lte: filters.dateTo }),
          },
        }),
      },
      take: pagination.limit,
      ...(pagination.cursor && { cursor: { id: pagination.cursor }, skip: 1 }),
      // UUIDv7 ids are time-ordered — id order IS creation order.
      orderBy: { id: 'desc' },
    });

    return activities.map((activity: ActivityModel): ActivityInterface => this.toDomain(activity));
  }

  private toDomain(activity: ActivityModel): ActivityInterface {
    return {
      id: activity.id,
      userId: activity.userId,
      actorId: activity.actorId,
      sessionId: activity.sessionId,
      type: ActivityTypeEnum[activity.type],
      meta: (activity.meta as Record<string, unknown> | null) ?? null,
      ip: activity.ip,
      createdAt: activity.createdAt,
    };
  }

  // Deletes at most `limit` rows per call. The caller loops; this does not.
  //
  // Two statements rather than one `deleteMany`, because Prisma's deleteMany
  // takes no `take` — an unbounded delete on a table that has grown for a year
  // holds a lock long enough to be an outage of its own. Selecting the ids
  // first bounds the write to exactly the rows chosen.
  public async deleteOlderThan(cutoff: Date, limit: number): Promise<number> {
    const doomed: { id: string }[] = await this.prisma.activity.findMany({
      where: { createdAt: { lt: cutoff } },
      select: { id: true },
      take: limit,
    });

    if (doomed.length === 0) return 0;

    const deleted = await this.prisma.activity.deleteMany({
      where: { id: { in: doomed.map((row: { id: string }): string => row.id) } },
    });

    return deleted.count;
  }
}
