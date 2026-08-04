// The plaintext `key` is present only in this one response — it is never
// returned again by any other endpoint (list/detail expose `prefix` only).
export interface CreateApiKeyResponseInterface {
  readonly id: string;
  readonly name: string;
  readonly key: string;
  readonly prefix: string;
  readonly createdAt: string;
}
