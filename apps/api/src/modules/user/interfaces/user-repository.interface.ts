import type { UnlinkMethodResultEnum } from '@modules/user/enums/unlink-method-result.enum.js';
import type { AdminUserInterface } from '@modules/user/interfaces/admin-user.interface.js';
import type { AdminUsersQueryInterface } from '@modules/user/interfaces/admin-users-query.interface.js';
import type { AuthMethodInterface } from '@modules/user/interfaces/auth-method.interface.js';
import type { CreateEmailUserDataInterface } from '@modules/user/interfaces/create-email-user-data.interface.js';
import type { CreateOauthMethodDataInterface } from '@modules/user/interfaces/create-oauth-method-data.interface.js';
import type { CreateOauthUserDataInterface } from '@modules/user/interfaces/create-oauth-user-data.interface.js';
import type { UpdateProfileDataInterface } from '@modules/user/interfaces/update-profile-data.interface.js';
import type { UserInterface } from '@modules/user/interfaces/user.interface.js';
import type { UserWithMethodTypesInterface } from '@modules/user/interfaces/user-with-method-types.interface.js';
import type { UserStatusEnum } from '@nest-aws-starter/shared';

export interface UserRepositoryInterface {
  createWithEmailMethod(data: CreateEmailUserDataInterface): Promise<UserInterface>;
  createWithOauthMethod(data: CreateOauthUserDataInterface): Promise<UserInterface>;
  findById(id: string): Promise<UserInterface | null>;
  findByAuthEmail(email: string): Promise<UserWithMethodTypesInterface | null>;
  findEmailMethodByEmail(email: string): Promise<AuthMethodInterface | null>;
  findMethodByProviderAccount(
    type: CreateOauthMethodDataInterface['type'],
    providerAccountId: string,
  ): Promise<AuthMethodInterface | null>;
  addOauthMethod(userId: string, data: CreateOauthMethodDataInterface): Promise<void>;
  addEmailMethod(userId: string, email: string, passwordHash: string): Promise<void>;
  findMethodsByUserId(userId: string): Promise<AuthMethodInterface[]>;
  // Deletes the method only while the account keeps at least one other way
  // in, enforced under a lock rather than by a preceding read.
  removeMethodUnlessLast(
    userId: string,
    type: CreateOauthMethodDataInterface['type'],
  ): Promise<UnlinkMethodResultEnum>;
  findEmailMethodByUserId(userId: string): Promise<AuthMethodInterface | null>;
  markEmailVerified(methodId: string): Promise<void>;
  updatePasswordHash(methodId: string, passwordHash: string): Promise<void>;
  touchMethodLastUsed(methodId: string, now: Date): Promise<void>;
  updateProfile(id: string, data: UpdateProfileDataInterface): Promise<UserInterface | null>;
  updateStatus(id: string, status: UserStatusEnum): Promise<UserInterface | null>;
  findManyForAdmin(query: AdminUsersQueryInterface): Promise<AdminUserInterface[]>;
  findByIdForAdmin(id: string): Promise<AdminUserInterface | null>;
}
