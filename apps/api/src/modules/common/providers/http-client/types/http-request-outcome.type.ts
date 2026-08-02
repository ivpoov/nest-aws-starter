import type { HttpFailureOutcomeInterface } from '@providers/http-client/interfaces/http-failure-outcome.interface.js';
import type { HttpSuccessOutcomeInterface } from '@providers/http-client/interfaces/http-success-outcome.interface.js';

export type HttpRequestOutcomeType<T> =
  | HttpSuccessOutcomeInterface<T>
  | HttpFailureOutcomeInterface;
