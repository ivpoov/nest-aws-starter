// Mirrors the Prisma WebhookEventStatus column values — kept as our own enum
// (never @prisma/client's) so domain code never imports a generated type.
export enum WebhookEventStatusEnum {
  RECEIVED = 'RECEIVED',
  PROCESSED = 'PROCESSED',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED',
}
