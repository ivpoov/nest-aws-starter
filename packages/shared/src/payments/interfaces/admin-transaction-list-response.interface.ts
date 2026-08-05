import type { AdminTransactionResponseInterface } from './admin-transaction-response.interface.js';

export interface AdminTransactionListResponseInterface {
  readonly items: AdminTransactionResponseInterface[];
  readonly nextCursor: string | null;
}
