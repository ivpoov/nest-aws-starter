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
  updateProfile(id: string, data: UpdateProfileDataInterface): Promise<UserInterface | null>;
}
