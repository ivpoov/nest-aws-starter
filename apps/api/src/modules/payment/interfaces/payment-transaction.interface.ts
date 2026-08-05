import type { TransactionStatusEnum } from '@nest-aws-starter/shared';

export interface PaymentTransactionInterface {
  readonly id: string;
  readonly userId: string;
  readonly subscriptionId: string | null;
  readonly status: TransactionStatusEnum;
  readonly amountCents: number;
  readonly currency: string;
  readonly provider: string;
  readonly providerRef: string;
  readonly createdAt: Date;
}
