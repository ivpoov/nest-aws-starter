import type { TransactionStatusEnum } from '../enums/transaction-status.enum.js';

// Same fields as TransactionResponseInterface plus the owning user id — the
// admin list follows the activity admin list precedent: raw userId only, no
// joined user display data (the admin users page is where names/emails are
// looked up, the same way it backs the activity admin user-search filter).
export interface AdminTransactionResponseInterface {
  readonly id: string;
  readonly userId: string;
  readonly status: TransactionStatusEnum;
  readonly amountCents: number;
  readonly currency: string;
  readonly provider: string;
  readonly providerRef: string;
  readonly createdAt: string;
  readonly subscriptionId: string | null;
}
