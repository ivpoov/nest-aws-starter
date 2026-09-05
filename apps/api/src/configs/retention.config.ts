import { validateConfigSchema } from '@helpers/validate-config-schema.helper.js';
import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const configSchema = z.object({
  isEnabled: z.boolean(),
  activityDays: z.number().int().positive(),
  notificationDays: z.number().int().positive(),
  sessionDays: z.number().int().positive(),
  webhookEventDays: z.number().int().positive(),
  batchSize: z.number().int().positive(),
});

export type RetentionConfig = z.infer<typeof configSchema>;

// Nothing in this application used to delete anything. Every table below grows
// for as long as the deployment runs, and it fails silently: no error, no
// failing test, no alert — just queries that are fast in month one and slow in
// month twelve, on the tables nobody thinks to look at.
//
// The defaults are deliberately CONSERVATIVE. Retention is a policy decision
// that belongs to whoever runs the deployment, and possibly to their lawyers;
// a starter that quietly deleted a year of audit history because nobody
// changed a default would be worse than one that kept everything.
//
//   activityDays        365. The activity log is the closest thing here to
//                       audit evidence, so it is kept the longest and is the
//                       first window to raise, never lower, without a reason.
//   notificationDays    180. Read or unread, a six-month-old notification is
//                       not something a user will act on. Receipts go with
//                       their notification through the schema's cascade.
//   sessionDays         90, counted from EXPIRY, not creation — a session is
//                       only ever deleted after it has already stopped being
//                       usable.
//   webhookEventDays    90, and only for events that reached a terminal state.
//                       An event still RECEIVED or FAILED is unfinished work
//                       or evidence of a bug, and deleting it would destroy
//                       the record of a payment the provider says it sent.
//
// batchSize bounds one DELETE. The point is not speed: it is that a single
// unbounded `deleteMany` on a table that has grown for a year takes a lock
// long enough to be an outage of its own.
export const retentionConfig = registerAs('retention', (): RetentionConfig => {
  return validateConfigSchema(configSchema, {
    isEnabled: process.env.RETENTION_ENABLED !== 'false',
    activityDays: Number(process.env.RETENTION_ACTIVITY_DAYS ?? 365),
    notificationDays: Number(process.env.RETENTION_NOTIFICATION_DAYS ?? 180),
    sessionDays: Number(process.env.RETENTION_SESSION_DAYS ?? 90),
    webhookEventDays: Number(process.env.RETENTION_WEBHOOK_EVENT_DAYS ?? 90),
    batchSize: Number(process.env.RETENTION_BATCH_SIZE ?? 1_000),
  });
});
