import type { CurrentUserInterface } from '@interfaces/current-user.interface.js';
import { ABILITY_METADATA_KEY } from '@modules/casl/constants/casl.constants.js';
import { CASL_FORBIDDEN } from '@modules/casl/constants/casl-errors.constants.js';
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
    const requirement: AbilityRequirementInterface | undefined = this.reflector.get(
      ABILITY_METADATA_KEY,
      context.getHandler(),
    );

    if (!requirement) return true;

    const request: FastifyRequest & { user?: CurrentUserInterface } = context
      .switchToHttp()
      .getRequest();
    const user: CurrentUserInterface | undefined = request.user;

    if (!user) throw new ForbiddenError(CASL_FORBIDDEN);

    const ability: AppAbilityType = this.abilityFactory.createForUser(user);

    if (!ability.can(requirement.action, requirement.subject)) {
      throw new ForbiddenError(CASL_FORBIDDEN);
    }

    return true;
  }
}
