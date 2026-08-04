export interface ApiKeyResponseInterface {
  readonly id: string;
  readonly name: string;
  readonly prefix: string;
  readonly lastUsedAt: string | null;
  readonly revokedAt: string | null;
  readonly createdAt: string;
}
