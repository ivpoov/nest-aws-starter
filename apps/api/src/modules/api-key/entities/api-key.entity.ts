import type { ApiKeyInterface } from '@modules/api-key/interfaces/api-key.interface.js';

// CASL subject class — the ability metadata target for api-key permissions.
export class ApiKeyEntity implements ApiKeyInterface {
  declare readonly id: string;
  declare readonly name: string;
  declare readonly prefix: string;
  declare readonly ownerId: string;
  declare readonly lastUsedAt: Date | null;
  declare readonly revokedAt: Date | null;
  declare readonly createdAt: Date;
}
