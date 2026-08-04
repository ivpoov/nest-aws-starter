import type { ApiKeyInterface } from '@modules/api-key/interfaces/api-key.interface.js';

export interface ApiKeyListInterface {
  readonly items: ApiKeyInterface[];
  readonly nextCursor: string | null;
}
