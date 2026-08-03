import type { UserInterface } from '@modules/user/interfaces/user.interface.js';

export interface UserProfileInterface extends UserInterface {
  readonly avatarUrl: string | null;
}
