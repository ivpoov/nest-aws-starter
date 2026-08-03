import { Prisma } from '@generated/prisma/client.js';
import { AuthMethodType } from '@generated/prisma/enums.js';
import type { AuthMethodModel, UserModel } from '@generated/prisma/models.js';
import { PrismaService } from '@modules/prisma/services/prisma.service.js';
import type { AdminUserInterface } from '@modules/user/interfaces/admin-user.interface.js';
import type { AdminUsersQueryInterface } from '@modules/user/interfaces/admin-users-query.interface.js';
import type { AuthMethodInterface } from '@modules/user/interfaces/auth-method.interface.js';
import type { CreateEmailUserDataInterface } from '@modules/user/interfaces/create-email-user-data.interface.js';
import type { CreateOauthMethodDataInterface } from '@modules/user/interfaces/create-oauth-method-data.interface.js';
import type { CreateOauthUserDataInterface } from '@modules/user/interfaces/create-oauth-user-data.interface.js';
import type { UpdateProfileDataInterface } from '@modules/user/interfaces/update-profile-data.interface.js';
import type { UserInterface } from '@modules/user/interfaces/user.interface.js';
import type { UserRepositoryInterface } from '@modules/user/interfaces/user-repository.interface.js';
import type { UserWithMethodTypesInterface } from '@modules/user/interfaces/user-with-method-types.interface.js';
import { AuthMethodTypeEnum, UserRoleEnum, UserStatusEnum } from '@nest-aws-starter/shared';
import { Injectable } from '@nestjs/common';

@Injectable()
export class UserPrismaRepository implements UserRepositoryInterface {
  constructor(private readonly prisma: PrismaService) {}

  public async createWithEmailMethod(data: CreateEmailUserDataInterface): Promise<UserInterface> {
    // Nested write = one transaction: the user never exists without its method.
    const user: UserModel = await this.prisma.user.create({
      data: {
        displayName: data.displayName,
        authMethods: {
          create: {
            type: AuthMethodType.EMAIL,
            email: data.email,
            passwordHash: data.passwordHash,
          },
        },
      },
    });

    return this.toDomain(user);
  }

  public async createWithOauthMethod(data: CreateOauthUserDataInterface): Promise<UserInterface> {
    const user: UserModel = await this.prisma.user.create({
      data: {
        displayName: data.displayName,
        authMethods: {
          create: {
            type: AuthMethodType[data.type],
            providerAccountId: data.providerAccountId,
            email: data.email,
            isEmailVerified: data.isEmailVerified,
          },
        },
      },
    });

    return this.toDomain(user);
  }

  public async findById(id: string): Promise<UserInterface | null> {
    const user: UserModel | null = await this.prisma.user.findUnique({ where: { id } });

    return user ? this.toDomain(user) : null;
  }

  public async findByAuthEmail(email: string): Promise<UserWithMethodTypesInterface | null> {
    const user = await this.prisma.user.findFirst({
      where: { authMethods: { some: { email } } },
      include: { authMethods: { select: { type: true } } },
    });

    if (!user) return null;

    return {
      ...this.toDomain(user),
      methodTypes: user.authMethods.map(
        (method: { type: AuthMethodType }): AuthMethodTypeEnum => AuthMethodTypeEnum[method.type],
      ),
    };
  }

  public async findEmailMethodByEmail(email: string): Promise<AuthMethodInterface | null> {
    const method: AuthMethodModel | null = await this.prisma.authMethod.findUnique({
      where: { type_email: { type: AuthMethodType.EMAIL, email } },
    });

    return method ? this.methodToDomain(method) : null;
  }

  public async findMethodByProviderAccount(
    type: CreateOauthMethodDataInterface['type'],
    providerAccountId: string,
  ): Promise<AuthMethodInterface | null> {
    const method: AuthMethodModel | null = await this.prisma.authMethod.findUnique({
      where: { type_providerAccountId: { type: AuthMethodType[type], providerAccountId } },
    });

    return method ? this.methodToDomain(method) : null;
  }

  public async addOauthMethod(userId: string, data: CreateOauthMethodDataInterface): Promise<void> {
    await this.prisma.authMethod.create({
      data: {
        userId,
        type: AuthMethodType[data.type],
        providerAccountId: data.providerAccountId,
        email: data.email,
        isEmailVerified: data.isEmailVerified,
      },
    });
  }

  public async addEmailMethod(userId: string, email: string, passwordHash: string): Promise<void> {
    await this.prisma.authMethod.create({
      data: { userId, type: AuthMethodType.EMAIL, email, passwordHash },
    });
  }

  public async findMethodsByUserId(userId: string): Promise<AuthMethodInterface[]> {
    const methods: AuthMethodModel[] = await this.prisma.authMethod.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });

    return methods.map(
      (method: AuthMethodModel): AuthMethodInterface => this.methodToDomain(method),
    );
  }

  public async removeMethod(
    userId: string,
    type: CreateOauthMethodDataInterface['type'],
  ): Promise<boolean> {
    try {
      await this.prisma.authMethod.delete({
        where: { userId_type: { userId, type: AuthMethodType[type] } },
      });

      return true;
    } catch (caught) {
      if (caught instanceof Prisma.PrismaClientKnownRequestError && caught.code === 'P2025') {
        return false;
      }

      throw caught;
    }
  }

  public async findEmailMethodByUserId(userId: string): Promise<AuthMethodInterface | null> {
    const method: AuthMethodModel | null = await this.prisma.authMethod.findUnique({
      where: { userId_type: { userId, type: AuthMethodType.EMAIL } },
    });

    return method ? this.methodToDomain(method) : null;
  }

  public async markEmailVerified(methodId: string): Promise<void> {
    await this.prisma.authMethod.update({
      where: { id: methodId },
      data: { isEmailVerified: true },
    });
  }

  public async updatePasswordHash(methodId: string, passwordHash: string): Promise<void> {
    await this.prisma.authMethod.update({ where: { id: methodId }, data: { passwordHash } });
  }

  public async touchMethodLastUsed(methodId: string, now: Date): Promise<void> {
    try {
      await this.prisma.authMethod.update({ where: { id: methodId }, data: { lastUsedAt: now } });
    } catch (caught) {
      if (caught instanceof Prisma.PrismaClientKnownRequestError && caught.code === 'P2025') return;

      throw caught;
    }
  }

  public async updateProfile(
    id: string,
    data: UpdateProfileDataInterface,
  ): Promise<UserInterface | null> {
    try {
      const user: UserModel = await this.prisma.user.update({
        where: { id },
        data: {
          ...(data.displayName !== undefined && { displayName: data.displayName }),
          ...(data.avatarKey !== undefined && { avatarKey: data.avatarKey }),
        },
      });

      return this.toDomain(user);
    } catch (caught) {
      if (caught instanceof Prisma.PrismaClientKnownRequestError && caught.code === 'P2025') {
        return null;
      }

      throw caught;
    }
  }

  public async findManyForAdmin(query: AdminUsersQueryInterface): Promise<AdminUserInterface[]> {
    const users = await this.prisma.user.findMany({
      where: query.search
        ? {
            OR: [
              { displayName: { contains: query.search, mode: 'insensitive' } },
              { authMethods: { some: { email: { contains: query.search, mode: 'insensitive' } } } },
            ],
          }
        : {},
      include: { authMethods: { select: { type: true, email: true } } },
      take: query.limit,
      ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
      orderBy: { id: 'desc' },
    });

    return users.map((user): AdminUserInterface => this.toAdminDomain(user));
  }

  public async findByIdForAdmin(id: string): Promise<AdminUserInterface | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { authMethods: { select: { type: true, email: true } } },
    });

    return user ? this.toAdminDomain(user) : null;
  }

  private toAdminDomain(
    user: UserModel & { authMethods: Array<{ type: AuthMethodType; email: string | null }> },
  ): AdminUserInterface {
    const emailMethod = user.authMethods.find(
      (method): boolean => method.type === AuthMethodType.EMAIL,
    );

    return {
      ...this.toDomain(user),
      email: emailMethod?.email ?? user.authMethods.find((method) => method.email)?.email ?? null,
      methodTypes: user.authMethods.map(
        (method): AuthMethodTypeEnum => AuthMethodTypeEnum[method.type],
      ),
    };
  }

  private methodToDomain(method: AuthMethodModel): AuthMethodInterface {
    return {
      id: method.id,
      userId: method.userId,
      type: AuthMethodTypeEnum[method.type],
      email: method.email,
      isEmailVerified: method.isEmailVerified,
      passwordHash: method.passwordHash,
      providerAccountId: method.providerAccountId,
      createdAt: method.createdAt,
      lastUsedAt: method.lastUsedAt,
    };
  }

  private toDomain(user: UserModel): UserInterface {
    return {
      id: user.id,
      displayName: user.displayName,
      role: UserRoleEnum[user.role],
      status: UserStatusEnum[user.status],
      avatarKey: user.avatarKey,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
