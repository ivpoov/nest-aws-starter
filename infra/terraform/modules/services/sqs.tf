# ---------------------------------------------------------------------------
# Payment webhook queue + dead-letter queue
#
# WHY maxReceiveCount IS WHAT IT IS
#
# PaymentWebhookConsumerService drives its own attempt accounting. On a failed
# dispatch it calls recordFailure() and, while attempts < MAX_WEBHOOK_ATTEMPTS,
# returns without deleting the message — SQS redelivers it once the visibility
# timeout lapses. On the attempt that reaches MAX_WEBHOOK_ATTEMPTS it marks the
# row FAILED and *does* delete the message. So on the ordinary failure path a
# single message is received at most MAX_WEBHOOK_ATTEMPTS times and then leaves
# the queue under the application's own control.
#
#   MAX_WEBHOOK_ATTEMPTS = 5
#   apps/api/src/modules/payment/constants/webhook-consumer.constants.ts
#
# Setting maxReceiveCount to that same 5 is therefore not a second retry budget
# stacked on the first — it is the backstop for everything the application's
# accounting cannot see: a task killed mid-dispatch before the delete, a Redis
# lock permanently held by a dead holder, or a message whose processing throws
# before recordFailure ever runs (Postgres down). Those messages are received a
# sixth time, and a sixth receive is by definition a message the consumer is
# stuck on rather than failing on. The DLQ is exactly where it belongs.
#
# Set it lower and you dead-letter events the application would still have
# retried. Set it higher and a genuinely stuck message loops on the main queue
# forever, invisible.
#
# NOT the same ceiling: WEBHOOK_RETRY_MAX_ATTEMPTS = 8 in
# webhook-retry.constants.ts. The retry job re-enqueues a *new* message, whose
# receive count starts at zero, so 8 is the cross-message lifetime ceiling and
# is deliberately not what maxReceiveCount tracks.
# ---------------------------------------------------------------------------

locals {
  # Built by hand rather than read off aws_sqs_queue.webhook: the main queue
  # points at the DLQ (redrive_policy) and the DLQ points back at the main queue
  # (redrive_allow_policy), which is a dependency cycle if both sides use
  # resource references. The name is known up front, so the ARN is too.
  webhook_queue_arn = format(
    "arn:%s:sqs:%s:%s:%s",
    data.aws_partition.current.partition,
    data.aws_region.current.region,
    data.aws_caller_identity.current.account_id,
    var.webhook_queue_name,
  )
}

resource "aws_sqs_queue" "webhook_dlq" {
  name = var.webhook_dlq_name

  # Long retention: a dead letter is evidence. It has to still be there on
  # Monday morning.
  message_retention_seconds = var.webhook_dlq_retention_days * 24 * 60 * 60

  # SSE-SQS rather than SSE-KMS — encryption at rest with no per-request key
  # charge and nothing extra to manage.
  sqs_managed_sse_enabled = true

  # Only the queue this DLQ exists for may redrive into it. Without this any
  # queue in the account could name it as its dead-letter target and quietly
  # mix its failures in with the payment ones.
  redrive_allow_policy = jsonencode({
    redrivePermission = "byQueue"
    sourceQueueArns   = [local.webhook_queue_arn]
  })
}

resource "aws_sqs_queue" "webhook" {
  name = var.webhook_queue_name

  # Must outlive WEBHOOK_LOCK_TTL_MS (30s): if the message reappeared while the
  # first consumer still held the per-event Redis lock, the second consumer
  # would find the lock held, decline to delete, and burn a receive for nothing.
  visibility_timeout_seconds = var.webhook_visibility_timeout_seconds

  message_retention_seconds = var.webhook_message_retention_days * 24 * 60 * 60

  # Queue-level default for long polling. The consumer passes its own
  # WaitTimeSeconds (1s) on every ReceiveMessage and so overrides this; the
  # default matters for anything else that reads the queue — console redrive,
  # a future Lambda trigger, an operator draining by hand.
  receive_wait_time_seconds = 20

  sqs_managed_sse_enabled = true

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.webhook_dlq.arn
    maxReceiveCount     = var.webhook_max_receive_count
  })
}
