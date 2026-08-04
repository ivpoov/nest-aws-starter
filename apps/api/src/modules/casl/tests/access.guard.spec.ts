import type { CurrentUserInterface } from '@interfaces/current-user.interface.js';
import { ActionsEnum } from '@modules/casl/enums/actions.enum.js';
import { AccessGuard } from '@modules/casl/guards/access.guard.js';
import { CaslAbilityFactoryService } from '@modules/casl/services/casl-ability-factory.service.js';
import type { PermissionsType } from '@modules/casl/types/permissions.type.js';
import { ForbiddenError } from '@modules/common/errors/forbidden.error.js';
import { UserRoleEnum } from '@nest-aws-starter/shared';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';

class TestUserEntity {}

const testPermissions: PermissionsType = {
  [UserRoleEnum.USER]: ({ can }) => can(ActionsEnum.READ, TestUserEntity),
  [UserRoleEnum.ADMIN]: ({ can }) => can(ActionsEnum.MANAGE, TestUserEntity),
};

function createGuard(isAdminRoute: boolean, hasAbility = true): AccessGuard {
  const reflector = {
    get: vi.fn((key: string) => {
      if (key === 'casl:ability') {
        return hasAbility ? { action: ActionsEnum.MANAGE, subject: TestUserEntity } : undefined;
      }
      if (key === 'casl:admin-scope') return isAdminRoute;

      return undefined;
    }),
  } as unknown as Reflector;
  const abilityFactory = new CaslAbilityFactoryService();

  abilityFactory.register(testPermissions);

  return new AccessGuard(reflector, abilityFactory);
}

function createContext(user: CurrentUserInterface): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('AccessGuard', () => {
  it('allows a non-impersonated admin on an admin route', () => {
    const guard = createGuard(true);
    const user: CurrentUserInterface = { id: 'admin-1', role: UserRoleEnum.ADMIN, sessionId: 's1' };

    expect(guard.canActivate(createContext(user))).toBe(true);
  });

  it('denies an impersonated caller on an admin route, even with ADMIN role', () => {
    const guard = createGuard(true);
    const user: CurrentUserInterface = {
      id: 'admin-1',
      role: UserRoleEnum.ADMIN,
      sessionId: 's1',
      actAsBy: 'other-admin',
    };

    try {
      guard.canActivate(createContext(user));
      expect.unreachable('should have thrown');
    } catch (caught) {
      expect(caught).toBeInstanceOf(ForbiddenError);
      expect((caught as ForbiddenError).args.code).toBe('ADMIN_IMPERSONATION_FORBIDDEN');
    }
  });

  it('allows an impersonated caller on a non-admin route', () => {
    const guard = createGuard(false);
    const user: CurrentUserInterface = {
      id: 'admin-1',
      role: UserRoleEnum.ADMIN,
      sessionId: 's1',
      actAsBy: 'other-admin',
    };

    expect(guard.canActivate(createContext(user))).toBe(true);
  });

  // Important fix under test: a handler on an @AdminScope() controller that
  // has no @UseAbility metadata at all (the `!requirement` early return)
  // must still deny an impersonated caller — the guarantee cannot depend on
  // every current and future admin handler remembering @UseAbility.
  it('denies an impersonated caller on an admin route even without @UseAbility metadata', () => {
    const guard = createGuard(true, false);
    const user: CurrentUserInterface = {
      id: 'admin-1',
      role: UserRoleEnum.ADMIN,
      sessionId: 's1',
      actAsBy: 'other-admin',
    };

    try {
      guard.canActivate(createContext(user));
      expect.unreachable('should have thrown');
    } catch (caught) {
      expect(caught).toBeInstanceOf(ForbiddenError);
      expect((caught as ForbiddenError).args.code).toBe('ADMIN_IMPERSONATION_FORBIDDEN');
    }
  });

  it('allows a non-impersonated caller through when there is no @UseAbility metadata', () => {
    const guard = createGuard(true, false);
    const user: CurrentUserInterface = { id: 'user-1', role: UserRoleEnum.USER, sessionId: 's1' };

    expect(guard.canActivate(createContext(user))).toBe(true);
  });
});
