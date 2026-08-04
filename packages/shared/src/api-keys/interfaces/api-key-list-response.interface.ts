import type { ApiKeyResponseInterface } from './api-key-response.interface.js';

export interface ApiKeyListResponseInterface {
  readonly items: ApiKeyResponseInterface[];
  readonly nextCursor: string | null;
}
