import type { CurrentUserInterface } from '@interfaces/current-user.interface.js';
import {
  ABILITY_METADATA_KEY,
  ADMIN_SCOPE_METADATA_KEY,
} from '@modules/casl/constants/casl.constants.js';
import {
  ADMIN_IMPERSONATION_FORBIDDEN,
  CASL_FORBIDDEN,
} from '@modules/casl/constants/casl-errors.constants.js';
import type { AbilityRequirementInterface } from '@modules/casl/interfaces/ability-requirement.interface.js';
import { CaslAbilityFactoryService } from '@modules/casl/services/casl-ability-factory.service.js';
import type { AppAbilityType } from '@modules/casl/types/app-ability.type.js';
import { ForbiddenError } from '@modules/common/errors/forbidden.error.js';
import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';

@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly abilityFactory: CaslAbilityFactoryService,
  ) {}

  public canActivate(context: ExecutionContext): boolean {
    const request: FastifyRequest & { user?: CurrentUserInterface } = context
      .switchToHttp()
      .getRequest();
    const user: CurrentUserInterface | undefined = request.user;

    // Defense in depth, unconditional: applies to EVERY handler on an
    // @AdminScope() controller, even one without @UseAbility — checked
    // before the ability-requirement early return below so the guarantee
    // never depends on a future admin route remembering to add @UseAbility.
    // No nesting, no privilege re-escalation through the very account
    // login-as put an admin into.
    if (user?.actAsBy && this.isAdminRoute(context)) {
      throw new ForbiddenError(ADMIN_IMPERSONATION_FORBIDDEN);
    }

    const requirement: AbilityRequirementInterface | undefined = this.reflector.get(
      ABILITY_METADATA_KEY,
      context.getHandler(),
    );

    if (!requirement) return true;

    if (!user) throw new ForbiddenError(CASL_FORBIDDEN);

    const ability: AppAbilityType = this.abilityFactory.createForUser(user);

    if (!ability.can(requirement.action, requirement.subject)) {
      throw new ForbiddenError(CASL_FORBIDDEN);
    }

    return true;
  }

  // @AdminScope() class marker, not the HTTP path — independent of the
  // global API prefix/version and explicit at the controller declaration.
  private isAdminRoute(context: ExecutionContext): boolean {
    return this.reflector.get(ADMIN_SCOPE_METADATA_KEY, context.getClass()) === true;
  }
}
