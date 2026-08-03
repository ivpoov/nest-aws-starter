import { Prisma } from '@generated/prisma/client.js';
import { ContactMessageStatus } from '@generated/prisma/enums.js';
import type { ContactMessageModel } from '@generated/prisma/models.js';
import type { CursorPaginationInterface } from '@interfaces/cursor-pagination.interface.js';
import type { ContactMessageInterface } from '@modules/contact-us/interfaces/contact-message.interface.js';
import type { ContactMessageFiltersInterface } from '@modules/contact-us/interfaces/contact-message-filters.interface.js';
import type { ContactMessageRepositoryInterface } from '@modules/contact-us/interfaces/contact-message-repository.interface.js';
import type { CreateContactMessageDataInterface } from '@modules/contact-us/interfaces/create-contact-message-data.interface.js';
import { PrismaService } from '@modules/prisma/services/prisma.service.js';
import { ContactMessageStatusEnum } from '@nest-aws-starter/shared';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ContactMessagePrismaRepository implements ContactMessageRepositoryInterface {
  constructor(private readonly prisma: PrismaService) {}

  public async create(data: CreateContactMessageDataInterface): Promise<ContactMessageInterface> {
    const message: ContactMessageModel = await this.prisma.contactMessage.create({ data });

    return this.toDomain(message);
  }

  public async findManyAfter(
    pagination: CursorPaginationInterface,
    filters: ContactMessageFiltersInterface,
  ): Promise<ContactMessageInterface[]> {
    const messages: ContactMessageModel[] = await this.prisma.contactMessage.findMany({
      where: {
        ...(filters.status && { status: ContactMessageStatus[filters.status] }),
      },
      take: pagination.limit,
      ...(pagination.cursor && { cursor: { id: pagination.cursor }, skip: 1 }),
      // UUIDv7 ids are time-ordered — id order IS creation order.
      orderBy: { id: 'desc' },
    });

    return messages.map(
      (message: ContactMessageModel): ContactMessageInterface => this.toDomain(message),
    );
  }

  public async updateStatus(
    id: string,
    status: ContactMessageStatusEnum,
  ): Promise<ContactMessageInterface | null> {
    try {
      const message: ContactMessageModel = await this.prisma.contactMessage.update({
        where: { id },
        data: { status: ContactMessageStatus[status] },
      });

      return this.toDomain(message);
    } catch (caught) {
      if (this.isRecordNotFound(caught)) return null;

      throw caught;
    }
  }

  // The single permitted Prisma-error touchpoint: P2025 = record not found,
  // mapped to a domain-neutral null so writes stay atomic (no pre-check race).
  private isRecordNotFound(caught: unknown): boolean {
    return caught instanceof Prisma.PrismaClientKnownRequestError && caught.code === 'P2025';
  }

  private toDomain(message: ContactMessageModel): ContactMessageInterface {
    return {
      id: message.id,
      name: message.name,
      email: message.email,
      subject: message.subject,
      body: message.body,
      status: ContactMessageStatusEnum[message.status],
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
    };
  }
}
