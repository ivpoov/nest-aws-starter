import type { PrismaClient } from '@generated/prisma/client.js';

// The client handed to a `$transaction` callback: the full client minus the
// methods that cannot run inside an interactive transaction.
export type PrismaTransactionType = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'
>;
