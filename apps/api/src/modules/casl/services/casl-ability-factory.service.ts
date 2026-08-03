import {
  AbilityBuilder,
  createMongoAbility,
  type ExtractSubjectType,
  type Subject,
} from '@casl/ability';
import type { CurrentUserInterface } from '@interfaces/current-user.interface.js';
import type { AppAbilityType } from '@modules/casl/types/app-ability.type.js';
import type { PermissionsType } from '@modules/casl/types/permissions.type.js';
import { Injectable } from '@nestjs/common';

@Injectable()
export class CaslAbilityFactoryService {
  private readonly permissionSets: PermissionsType[] = [];

  public register(permissions: PermissionsType): void {
    this.permissionSets.push(permissions);
  }

  public createForUser(user: CurrentUserInterface): AppAbilityType {
    const builder: AbilityBuilder<AppAbilityType> = new AbilityBuilder<AppAbilityType>(
      createMongoAbility,
    );

    for (const permissions of this.permissionSets) {
      permissions[user.role]?.({
        user,
        can: builder.can.bind(builder),
        cannot: builder.cannot.bind(builder),
      });
    }

    return builder.build({
      detectSubjectType: (subject: object): ExtractSubjectType<Subject> =>
        subject.constructor as ExtractSubjectType<Subject>,
    });
  }
}
