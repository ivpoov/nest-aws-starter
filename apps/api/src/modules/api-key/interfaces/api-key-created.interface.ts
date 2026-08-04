// Returned once, at creation only — carries the plaintext key. No repository
// method or other service call ever produces this shape again.
export interface ApiKeyCreatedInterface {
  readonly id: string;
  readonly name: string;
  readonly key: string;
  readonly prefix: string;
  readonly createdAt: Date;
}
