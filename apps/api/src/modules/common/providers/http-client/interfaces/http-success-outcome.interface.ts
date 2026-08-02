export interface HttpSuccessOutcomeInterface<T> {
  readonly ok: true;
  readonly data: T;
}
