import type { CreateContactRequestInterface } from '@nest-aws-starter/shared';

// `website` is not part of the shared wire contract on purpose — it is an
// API-only field, present here only so the form can submit it alongside the
// real fields.
export interface SubmitContactRequestInterface extends CreateContactRequestInterface {
  readonly website: string;
}
