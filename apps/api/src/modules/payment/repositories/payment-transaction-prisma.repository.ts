import { Prisma } from '@generated/prisma/client.js';
import type { PaymentTransactionModel } from '@generated/prisma/models.js';
import type { CreatePaymentTransactionDataInterface } from '@modules/payment/interfaces/create-payment-transaction-data.interface.js';
import type { CreatePaymentTransactionResultInterface } from '@modules/payment/interfaces/create-payment-transaction-result.interface.js';
import type { PaymentTransactionInterface } from '@modules/payment/interfaces/payment-transaction.interface.js';
import type { PaymentTransactionRepositoryInterface } from '@modules/payment/interfaces/payment-transaction-repository.interface.js';
import { PrismaService } from '@modules/prisma/services/prisma.service.js';
import { TransactionStatusEnum } from '@nest-aws-starter/shared';
import { Injectable } from '@nestjs/common';

@Injectable()
export class PaymentTransactionPrismaRepository implements PaymentTransactionRepositoryInterface {
  constructor(private readonly prisma: PrismaService) {}

  public async createIdempotent(
    data: CreatePaymentTransactionDataInterface,
  ): Promise<CreatePaymentTransactionResultInterface> {
    try {
      const created: PaymentTransactionModel = await this.prisma.paymentTransaction.create({
        data: {
          userId: data.userId,
          subscriptionId: data.subscriptionId,
          status: data.status,
          amountCents: data.amountCents,
          currency: data.currency,
          provider: data.provider,
          providerRef: data.providerRef,
        },
      });

      return { transaction: this.toDomain(created), isNew: true };
    } catch (caught) {
      if (!this.isDuplicate(caught)) throw caught;

      const existing: PaymentTransactionModel =
        await this.prisma.paymentTransaction.findUniqueOrThrow({
          where: {
            provider_providerRef: { provider: data.provider, providerRef: data.providerRef },
          },
        });

      return { transaction: this.toDomain(existing), isNew: false };
    }
  }

  // Same confined P2002-as-idempotency-signal extension documented in
  // webhook-event-prisma.repository.ts.
  private isDuplicate(caught: unknown): boolean {
    return caught instanceof Prisma.PrismaClientKnownRequestError && caught.code === 'P2002';
  }

  private toDomain(transaction: PaymentTransactionModel): PaymentTransactionInterface {
    return {
      id: transaction.id,
      userId: transaction.userId,
      subscriptionId: transaction.subscriptionId,
      status: TransactionStatusEnum[transaction.status],
      amountCents: transaction.amountCents,
      currency: transaction.currency,
      provider: transaction.provider,
      providerRef: transaction.providerRef,
      createdAt: transaction.createdAt,
    };
  }
}
