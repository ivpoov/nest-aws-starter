# This module takes resolved values, never a cost profile. The root stack reads
# local.profile.<key> and local.names and hands the results down, so there is no
# `var.cost_profile` comparison anywhere below this line — see the root
# locals.tf for why that rule exists.

# ---------------------------------------------------------------------------
# Uploads bucket
# ---------------------------------------------------------------------------

variable "uploads_bucket_name" {
  description = "Name of the uploads bucket. Comes from local.names.uploads_bucket, which already carries the account id that makes it globally unique."
  type        = string
}

variable "uploads_bucket_force_destroy" {
  description = "Whether `terraform destroy` may delete a non-empty uploads bucket. True only in the disposable profile; a stack that cannot be destroyed is worse than one that can."
  type        = bool
}

variable "uploads_cors_allowed_origins" {
  description = "Browser origins allowed to run presigned PUT/GET against the uploads bucket. This is a browser-side control, not an authorization control — the presigned signature is what authorizes the request."
  type        = list(string)

  validation {
    condition     = length(var.uploads_cors_allowed_origins) > 0
    error_message = "uploads_cors_allowed_origins must list at least one origin, or presigned browser uploads will be blocked by CORS."
  }
}

variable "uploads_noncurrent_version_retention_days" {
  description = "How long superseded object versions are kept before expiry. Versioning is what makes an accidental overwrite recoverable; this is what stops it becoming an unbounded bill."
  type        = number
  default     = 30

  validation {
    condition     = var.uploads_noncurrent_version_retention_days >= 1
    error_message = "uploads_noncurrent_version_retention_days must be at least 1."
  }
}

# ---------------------------------------------------------------------------
# Payment webhook queue
# ---------------------------------------------------------------------------

variable "webhook_queue_name" {
  description = "Name of the payment webhook queue."
  type        = string
}

variable "webhook_dlq_name" {
  description = "Name of the payment webhook dead-letter queue."
  type        = string
}

variable "webhook_max_receive_count" {
  description = <<-EOT
    Receives of one message before SQS moves it to the dead-letter queue.

    This must track MAX_WEBHOOK_ATTEMPTS in
    apps/api/src/modules/payment/constants/webhook-consumer.constants.ts.
    See sqs.tf for the full reasoning; changing one without the other either
    strands poison messages on the main queue or dead-letters events the
    application would still have retried.
  EOT
  type        = number
  default     = 5

  validation {
    condition     = var.webhook_max_receive_count >= 1 && var.webhook_max_receive_count <= 1000
    error_message = "webhook_max_receive_count must be between 1 and 1000 (SQS limit)."
  }
}

variable "webhook_visibility_timeout_seconds" {
  description = "How long a received webhook message stays invisible to other consumers. Must comfortably exceed WEBHOOK_LOCK_TTL_MS (30s) so a message is never redelivered while its Redis lock is still held."
  type        = number
  default     = 60

  validation {
    condition     = var.webhook_visibility_timeout_seconds >= 30 && var.webhook_visibility_timeout_seconds <= 43200
    error_message = "webhook_visibility_timeout_seconds must be between 30 and 43200 — below 30 it can expire while the consumer still holds its 30s Redis lock."
  }
}

variable "webhook_message_retention_days" {
  description = "How long an undelivered message survives on the main queue."
  type        = number
  default     = 4

  validation {
    condition     = var.webhook_message_retention_days >= 1 && var.webhook_message_retention_days <= 14
    error_message = "webhook_message_retention_days must be between 1 and 14 (SQS limit)."
  }
}

variable "webhook_dlq_retention_days" {
  description = "How long a dead-lettered message survives. Defaults to the SQS maximum: a dead letter is evidence, and it needs to outlive a long weekend before anyone looks at it."
  type        = number
  default     = 14

  validation {
    condition     = var.webhook_dlq_retention_days >= 1 && var.webhook_dlq_retention_days <= 14
    error_message = "webhook_dlq_retention_days must be between 1 and 14 (SQS limit)."
  }
}

# ---------------------------------------------------------------------------
# Notifications topic
# ---------------------------------------------------------------------------

variable "notifications_topic_name" {
  description = "Name of the application notification topic (fan-out for application events, distinct from the observability alerts topic)."
  type        = string
}

# ---------------------------------------------------------------------------
# Mail
# ---------------------------------------------------------------------------

variable "mail_domain" {
  description = "Domain to create an SES sending identity for. Null skips SES entirely — there is nothing to verify without a domain you control."
  type        = string
  default     = null
}

variable "mail_from_address" {
  description = "The single address the application is permitted to send from. Becomes the ses:FromAddress condition on the task role, so the role cannot send as anyone else. Null skips the SES statement."
  type        = string
  default     = null

  validation {
    condition     = var.mail_from_address == null || can(regex("^[^@\\s]+@[^@\\s]+\\.[a-z]{2,}$", var.mail_from_address))
    error_message = "mail_from_address must be a valid email address, or null."
  }
}

# ---------------------------------------------------------------------------
# IAM
# ---------------------------------------------------------------------------

variable "task_role_name" {
  description = "Name of the ECS task role — the identity the application's own AWS SDK calls run as."
  type        = string
}

variable "task_execution_role_name" {
  description = "Name of the ECS task execution role — the identity the ECS agent uses to pull images and write logs, before the container starts."
  type        = string
}

variable "ecr_repository_names" {
  description = "ECR repositories the execution role may pull from. The repositories themselves belong to the compute stack; only their ARNs are referenced here, so the two can land in either order."
  type        = list(string)
}

variable "log_group_name_prefix" {
  description = "Prefix of the CloudWatch log groups the execution role may write to, e.g. /aws/ecs/myapp-dev. Scoped with a trailing wildcard so one prefix covers the per-service groups."
  type        = string
}

variable "ssm_parameter_prefix" {
  description = "SSM parameter path the roles may read, e.g. /myapp/dev. Leading slash, no trailing slash."
  type        = string

  validation {
    condition     = can(regex("^/[^/].*[^/]$", var.ssm_parameter_prefix))
    error_message = "ssm_parameter_prefix must start with a slash and must not end with one (e.g. /myapp/dev)."
  }
}
