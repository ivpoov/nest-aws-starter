import { ABILITY_METADATA_KEY } from '@modules/casl/constants/casl.constants.js';
import type { ActionsEnum } from '@modules/casl/enums/actions.enum.js';
import type { AbilityRequirementInterface } from '@modules/casl/interfaces/ability-requirement.interface.js';
import { SetMetadata } from '@nestjs/common';

export function UseAbility(
  action: ActionsEnum,
  subject: AbilityRequirementInterface['subject'],
): MethodDecorator {
  return SetMetadata(ABILITY_METADATA_KEY, { action, subject });
}
