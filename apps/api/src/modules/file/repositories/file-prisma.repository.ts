import { Prisma } from '@generated/prisma/client.js';
import { FileIntent, FileStatus } from '@generated/prisma/enums.js';
import type { FileModel } from '@generated/prisma/models.js';
import type { CreateFileDataInterface } from '@modules/file/interfaces/create-file-data.interface.js';
import type { FileInterface } from '@modules/file/interfaces/file.interface.js';
import type { FileRepositoryInterface } from '@modules/file/interfaces/file-repository.interface.js';
import type { MarkFileReadyDataInterface } from '@modules/file/interfaces/mark-file-ready-data.interface.js';
import { PrismaService } from '@modules/prisma/services/prisma.service.js';
import { FileIntentEnum, FileStatusEnum } from '@nest-aws-starter/shared';
import { Injectable } from '@nestjs/common';

@Injectable()
export class FilePrismaRepository implements FileRepositoryInterface {
  constructor(private readonly prisma: PrismaService) {}

  public async create(data: CreateFileDataInterface): Promise<FileInterface> {
    const file: FileModel = await this.prisma.file.create({
      data: {
        ownerId: data.ownerId,
        intent: FileIntent[data.intent],
        key: data.key,
        contentType: data.contentType,
        size: data.size,
      },
    });

    return this.toDomain(file);
  }

  public async findById(id: string): Promise<FileInterface | null> {
    const file: FileModel | null = await this.prisma.file.findUnique({ where: { id } });

    return file ? this.toDomain(file) : null;
  }

  public async markReady(
    id: string,
    data: MarkFileReadyDataInterface,
  ): Promise<FileInterface | null> {
    try {
      const file: FileModel = await this.prisma.file.update({
        where: { id },
        data: {
          status: FileStatus.READY,
          contentType: data.contentType,
          size: data.size,
        },
      });

      return this.toDomain(file);
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

  private toDomain(file: FileModel): FileInterface {
    return {
      id: file.id,
      ownerId: file.ownerId,
      intent: FileIntentEnum[file.intent],
      key: file.key,
      contentType: file.contentType,
      size: file.size,
      status: FileStatusEnum[file.status],
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
    };
  }
}
