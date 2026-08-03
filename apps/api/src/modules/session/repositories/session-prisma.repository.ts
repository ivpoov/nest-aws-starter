import { Prisma } from '@generated/prisma/client.js';
import type { SessionModel } from '@generated/prisma/models.js';
import { PrismaService } from '@modules/prisma/services/prisma.service.js';
import type { CreateSessionDataInterface } from '@modules/session/interfaces/create-session-data.interface.js';
import type { SessionInterface } from '@modules/session/interfaces/session.interface.js';
import type { SessionRepositoryInterface } from '@modules/session/interfaces/session-repository.interface.js';
import { Injectable } from '@nestjs/common';

@Injectable()
export class SessionPrismaRepository implements SessionRepositoryInterface {
  constructor(private readonly prisma: PrismaService) {}

  public async create(data: CreateSessionDataInterface): Promise<SessionInterface> {
    const session: SessionModel = await this.prisma.session.create({
      data: { ...data, signedAsAdminId: data.signedAsAdminId ?? null },
    });

    return this.toDomain(session);
  }

  public async findById(id: string): Promise<SessionInterface | null> {
    const session: SessionModel | null = await this.prisma.session.findUnique({ where: { id } });

    return session ? this.toDomain(session) : null;
  }

  public async findActiveByUserId(userId: string, now: Date): Promise<SessionInterface[]> {
    const sessions: SessionModel[] = await this.prisma.session.findMany({
      where: { userId, activeUntil: { gt: now } },
      orderBy: { lastActiveAt: 'desc' },
    });

    return sessions.map((session: SessionModel): SessionInterface => this.toDomain(session));
  }

  public async touchLastActive(id: string, now: Date): Promise<void> {
    try {
      await this.prisma.session.update({ where: { id }, data: { lastActiveAt: now } });
    } catch (caught) {
      if (this.isRecordNotFound(caught)) return;

      throw caught;
    }
  }

  public async setActiveUntil(id: string, activeUntil: Date): Promise<boolean> {
    try {
      await this.prisma.session.update({ where: { id }, data: { activeUntil } });

      return true;
    } catch (caught) {
      if (this.isRecordNotFound(caught)) return false;

      throw caught;
    }
  }

  public async endAllByUserId(userId: string, now: Date): Promise<number> {
    const result: { count: number } = await this.prisma.session.updateMany({
      where: { userId, activeUntil: { gt: now } },
      data: { activeUntil: now },
    });

    return result.count;
  }

  private isRecordNotFound(caught: unknown): boolean {
    return caught instanceof Prisma.PrismaClientKnownRequestError && caught.code === 'P2025';
  }

  private toDomain(session: SessionModel): SessionInterface {
    return {
      id: session.id,
      userId: session.userId,
      device: session.device,
      ip: session.ip,
      createdAt: session.createdAt,
      lastActiveAt: session.lastActiveAt,
      activeUntil: session.activeUntil,
      signedAsAdminId: session.signedAsAdminId,
    };
  }
}
