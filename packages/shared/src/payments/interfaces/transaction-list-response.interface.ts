import type { TransactionResponseInterface } from './transaction-response.interface.js';

export interface TransactionListResponseInterface {
  readonly items: TransactionResponseInterface[];
  readonly nextCursor: string | null;
}
