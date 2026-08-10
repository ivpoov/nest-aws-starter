// Failure handling: after this many failed attempts the event is marked
// FAILED (message deleted) instead of being left for SQS visibility-timeout
// redelivery — it resurfaces via the retry job instead.
export const MAX_WEBHOOK_ATTEMPTS = 5;

// Lock TTL for the per-event Redis lock — generous relative to expected
// dispatch time so a slow-but-alive consumer never has its lock stolen
// mid-processing; a crashed holder still recovers via TTL expiry.
export const WEBHOOK_LOCK_TTL_MS = 30_000;

export const WEBHOOK_LOCK_KEY_PREFIX = 'webhook:';

// SQS ReceiveMessage batch size per long-poll.
export const MAX_MESSAGES_PER_POLL = 5;

// Pause between polls that returned zero messages — the provider's own
// WaitTimeSeconds (1s) already long-polls, so this just avoids a tight
// zero-wait loop hammering SQS when the queue briefly settles empty.
export const EMPTY_POLL_INTERVAL_MS = 1_000;
