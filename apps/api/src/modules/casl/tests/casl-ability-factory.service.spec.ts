import type { CurrentUserInterface } from '@interfaces/current-user.interface.js';
import { ActionsEnum } from '@modules/casl/enums/actions.enum.js';
import { CaslAbilityFactoryService } from '@modules/casl/services/casl-ability-factory.service.js';
import type { PermissionsType } from '@modules/casl/types/permissions.type.js';
import { UserRoleEnum } from '@nest-aws-starter/shared';
import { describe, expect, it } from 'vitest';

class TestNoteEntity {
  readonly userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }
}

const testPermissions: PermissionsType = {
  [UserRoleEnum.USER]: ({ user, can }) => {
    can(ActionsEnum.READ, TestNoteEntity);
    can(ActionsEnum.CREATE, TestNoteEntity);
    can(ActionsEnum.UPDATE, TestNoteEntity, { userId: user.id });
    can(ActionsEnum.DELETE, TestNoteEntity, { userId: user.id });
  },
  [UserRoleEnum.ADMIN]: ({ can }) => {
    can(ActionsEnum.MANAGE, TestNoteEntity);
  },
};

const regularUser: CurrentUserInterface = {
  id: 'user-1',
  role: UserRoleEnum.USER,
  sessionId: 'session-1',
};

const admin: CurrentUserInterface = {
  id: 'admin-1',
  role: UserRoleEnum.ADMIN,
  sessionId: 'session-2',
};

function createFactory(): CaslAbilityFactoryService {
  const factory: CaslAbilityFactoryService = new CaslAbilityFactoryService();

  factory.register(testPermissions);

  return factory;
}

describe('CaslAbilityFactoryService', () => {
  it('lets a user read and create at class level', () => {
    const ability = createFactory().createForUser(regularUser);

    expect(ability.can(ActionsEnum.READ, TestNoteEntity)).toBe(true);
    expect(ability.can(ActionsEnum.CREATE, TestNoteEntity)).toBe(true);
  });

  it('lets a user update own records but not foreign ones', () => {
    const ability = createFactory().createForUser(regularUser);

    expect(ability.can(ActionsEnum.UPDATE, new TestNoteEntity('user-1'))).toBe(true);
    expect(ability.can(ActionsEnum.UPDATE, new TestNoteEntity('someone-else'))).toBe(false);
  });

  it('lets an admin manage everything including foreign records', () => {
    const ability = createFactory().createForUser(admin);

    expect(ability.can(ActionsEnum.DELETE, new TestNoteEntity('someone-else'))).toBe(true);
    expect(ability.can(ActionsEnum.MANAGE, TestNoteEntity)).toBe(true);
  });

  it('denies everything for a role with no registered permissions', () => {
    const factory: CaslAbilityFactoryService = new CaslAbilityFactoryService();
    const ability = factory.createForUser(regularUser);

    expect(ability.can(ActionsEnum.READ, TestNoteEntity)).toBe(false);
  });
});
