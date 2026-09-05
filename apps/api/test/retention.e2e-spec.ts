import { randomUUID } from 'node:crypto';
import { ActivityService } from '@modules/activity/services/activity.service.js';
import { PrismaService } from '@modules/prisma/services/prisma.service.js';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './app.factory.js';

const DAY_MS = 86_400_000;

// Retention against real Postgres. The unit specs cover the loop and the
// cutoff arithmetic; what only a database can answer is whether the predicate
// actually matches the rows it is supposed to and leaves the rest alone.
describe('retention', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let activityService: ActivityService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    activityService = app.get(ActivityService);
  });

  afterAll(async () => {
    await app.close();
  });

  async function seedActivity(ageDays: number): Promise<string> {
    const id: string = randomUUID();

    await prisma.activity.create({
      data: {
        id,
        type: 'AUTH_LOGIN',
        createdAt: new Date(Date.now() - ageDays * DAY_MS),
      },
    });

    return id;
  }

  it('deletes rows past the window and keeps everything inside it', async () => {
    // The configured window is 365 days (retention.config.ts), so 400 is past
    // it and 10 is comfortably inside.
    const doomed: string = await seedActivity(400);
    const spared: string = await seedActivity(10);

    await activityService.purgeExpired();

    const survivors: { id: string }[] = await prisma.activity.findMany({
      where: { id: { in: [doomed, spared] } },
      select: { id: true },
    });

    expect(survivors.map((row: { id: string }): string => row.id)).toEqual([spared]);
  });

  // The batching is the part that could silently stop early and look like
  // success, so it is exercised with more rows than one batch holds.
  it('clears a backlog larger than a single batch', async () => {
    const ids: string[] = [];

    for (let index = 0; index < 12; index += 1) ids.push(await seedActivity(400));

    await activityService.purgeExpired();

    const remaining: number = await prisma.activity.count({ where: { id: { in: ids } } });

    expect(remaining).toBe(0);
  });
});
