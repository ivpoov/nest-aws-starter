import { Prisma } from '@generated/prisma/client.js';
import { AuthMethodType } from '@generated/prisma/enums.js';
import type { UserModel } from '@generated/prisma/models.js';
import { PrismaService } from '@modules/prisma/services/prisma.service.js';
import type { CreateEmailUserDataInterface } from '@modules/user/interfaces/create-email-user-data.interface.js';
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
