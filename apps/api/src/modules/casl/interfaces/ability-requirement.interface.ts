import type { SubjectClass } from '@casl/ability';
import type { ActionsEnum } from '@modules/casl/enums/actions.enum.js';

export interface AbilityRequirementInterface {
  readonly subject: SubjectClass;
  readonly action: ActionsEnum;
}
