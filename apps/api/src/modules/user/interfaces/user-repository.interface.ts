import type { AuthMethodInterface } from '@modules/user/interfaces/auth-method.interface.js';
import type { CreateEmailUserDataInterface } from '@modules/user/interfaces/create-email-user-data.interface.js';
import type { CreateOauthUserDataInterface } from '@modules/user/interfaces/create-oauth-user-data.interface.js';
import type { UpdateProfileDataInterface } from '@modules/user/interfaces/update-profile-data.interface.js';
import type { UserInterface } from '@modules/user/interfaces/user.interface.js';
import type { UserWithMethodTypesInterface } from '@modules/user/interfaces/user-with-method-types.interface.js';

export interface UserRepositoryInterface {
  createWithEmailMethod(data: CreateEmailUserDataInterface): Promise<UserInterface>;
  createWithOauthMethod(data: CreateOauthUserDataInterface): Promise<UserInterface>;
  findById(id: string): Promise<UserInterface | null>;
  findByAuthEmail(email: string): Promise<UserWithMethodTypesInterface | null>;
  findEmailMethodByEmail(email: string): Promise<AuthMethodInterface | null>;
  findEmailMethodByUserId(userId: string): Promise<AuthMethodInterface | null>;
  markEmailVerified(methodId: string): Promise<void>;
  updatePasswordHash(methodId: string, passwordHash: string): Promise<void>;
  touchMethodLastUsed(methodId: string, now: Date): Promise<void>;
  updateProfile(id: string, data: UpdateProfileDataInterface): Promise<UserInterface | null>;
}
