import type { TransactionStatusEnum } from '../enums/transaction-status.enum.js';

export interface TransactionResponseInterface {
  readonly id: string;
  readonly status: TransactionStatusEnum;
  readonly amountCents: number;
  readonly currency: string;
  readonly provider: string;
  readonly providerRef: string;
  readonly createdAt: string;
  readonly subscriptionId: string | null;
}
