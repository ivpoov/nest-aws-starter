import type { AbilityBuilder } from '@casl/ability';
import type { CurrentUserInterface } from '@interfaces/current-user.interface.js';
import type { AppAbilityType } from '@modules/casl/types/app-ability.type.js';

export interface PermissionContextInterface {
  readonly user: CurrentUserInterface;
  readonly can: AbilityBuilder<AppAbilityType>['can'];
  readonly cannot: AbilityBuilder<AppAbilityType>['cannot'];
}
