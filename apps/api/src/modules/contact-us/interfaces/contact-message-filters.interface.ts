import type { ContactMessageStatusEnum } from '@nest-aws-starter/shared';

export interface ContactMessageFiltersInterface {
  readonly status?: ContactMessageStatusEnum | null | undefined;
}
