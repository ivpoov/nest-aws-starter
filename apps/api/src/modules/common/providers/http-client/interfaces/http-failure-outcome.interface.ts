export interface HttpFailureOutcomeInterface {
  readonly ok: false;
  readonly status: number | null;
  readonly retryable: boolean;
}
