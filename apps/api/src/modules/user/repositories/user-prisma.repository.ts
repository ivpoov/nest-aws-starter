import { Prisma } from '@generated/prisma/client.js';
import { AuthMethodType } from '@generated/prisma/enums.js';
import type { AuthMethodModel, UserModel } from '@generated/prisma/models.js';
import { PrismaService } from '@modules/prisma/services/prisma.service.js';
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
