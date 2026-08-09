# ---------------------------------------------------------------------------
# Services: uploads bucket, payment webhook queue + DLQ, notification topic,
# SES identity, and the two ECS task roles.
#
# Everything the module needs is resolved here — names from local.names, the
# cost/durability knob from local.profile — so nothing below the module boundary
# ever sees var.cost_profile.
# ---------------------------------------------------------------------------

variable "cors_allowed_origins" {
  description = <<-EOT
    Browser origins allowed to run presigned uploads against the uploads bucket.

    Empty by default, and empty is the useful setting: the list is then taken
    from the edge module, which knows every hostname the two frontends are
    actually served from — including the *.cloudfront.net ones AWS only assigns
    at apply time. That is what replaced the old `["*"]` fallback, which is what
    this stack fell back to whenever domain_name was unset, which is the common
    case for a demo.

    Set it to pin the list by hand: an extra origin the stack cannot know about
    (a frontend hosted elsewhere), or a local dev server working against
    deployed infrastructure, e.g. ["http://localhost:5173"].

    CORS is a browser control, not an authorization control — the presigned
    signature is what authorizes an upload and it expires in minutes. Narrow
    this anyway: it is free, and it is the difference between "any page on the
    internet may drive an upload with a leaked URL" and "the app may".
  EOT
  type        = list(string)
  default     = []

  validation {
    condition = alltrue([
      for origin in var.cors_allowed_origins :
      origin == "*" || can(regex("^https?://[a-z0-9.*-]+(:[0-9]{1,5})?$", origin))
    ])
    error_message = "Each entry must be an origin — scheme://host with an optional port, no path and no trailing slash (e.g. https://app.example.com, http://localhost:5173) — or the literal \"*\"."
  }
}

locals {
  # Origins allowed to run a presigned PUT from a browser, and never "*".
  #
  # With a custom domain the edge module's list is the apex, www and admin
  # hostnames; without one it is the CloudFront hostnames AWS assigns at apply
  # time. Either way it is read from the module rather than rebuilt here, which
  # is the same source the API's CORS_ORIGINS comes from in compute.tf — so a
  # browser cannot be allowed to load the app from an origin the bucket then
  # refuses, or the reverse.
  uploads_cors_allowed_origins = (
    length(var.cors_allowed_origins) > 0
    ? var.cors_allowed_origins
    : module.edge.cors_origins
  )

  # No mail domain means no SES identity and no ses:SendEmail on the task role:
  # there is nothing to verify and nowhere legitimate to send from. Change the
  # local part here if your transactional mail should come from something other
  # than no-reply@.
  mail_from_address = var.domain_name == null ? null : "no-reply@${var.domain_name}"
}

module "services" {
  source = "./modules/services"

  uploads_bucket_name          = local.names.uploads_bucket
  uploads_bucket_force_destroy = local.profile.force_destroy_bucket
  uploads_cors_allowed_origins = local.uploads_cors_allowed_origins

  webhook_queue_name = local.names.payment_webhook_queue
  webhook_dlq_name   = local.names.payment_webhook_dlq

  notifications_topic_name = local.names.notifications_topic

  mail_domain       = var.domain_name
  mail_from_address = local.mail_from_address

  task_role_name           = local.names.task_role
  task_execution_role_name = local.names.task_execution_role
  ecr_repository_names     = [local.names.ecr_api, local.names.ecr_web]

  # One prefix rather than a list of groups: the execution role is scoped to it
  # with a trailing wildcard, so adding a service does not mean widening IAM.
  log_group_name_prefix = local.ecs_log_group_prefix
  ssm_parameter_prefix  = local.secret_prefix
}

# ---------------------------------------------------------------------------
# Outputs
# ---------------------------------------------------------------------------

output "uploads_bucket_name" {
  description = "Uploads bucket. The API reads this as S3_BUCKET_NAME."
  value       = module.services.uploads_bucket_name
}

output "uploads_bucket_arn" {
  description = "ARN of the uploads bucket."
  value       = module.services.uploads_bucket_arn
}

output "uploads_bucket_regional_domain_name" {
  description = "Regional domain name of the uploads bucket, for use as a CloudFront origin."
  value       = module.services.uploads_bucket_regional_domain_name
}

output "payment_webhook_queue_url" {
  description = "Payment webhook queue. The API reads this as SQS_PAYMENT_WEBHOOK_QUEUE_URL."
  value       = module.services.payment_webhook_queue_url
}

output "payment_webhook_queue_arn" {
  description = "ARN of the payment webhook queue."
  value       = module.services.payment_webhook_queue_arn
}

output "payment_webhook_dlq_url" {
  description = "Payment webhook dead-letter queue."
  value       = module.services.payment_webhook_dlq_url
}

output "payment_webhook_dlq_arn" {
  description = "ARN of the payment webhook dead-letter queue. Alarm on its depth in the observability stack."
  value       = module.services.payment_webhook_dlq_arn
}

output "payment_webhook_max_receive_count" {
  description = "Receives before a webhook message is dead-lettered, matched to the API consumer's own attempt ceiling."
  value       = module.services.payment_webhook_max_receive_count
}

output "notifications_topic_arn" {
  description = "Application notification topic."
  value       = module.services.notifications_topic_arn
}

output "ses_domain_identity_arn" {
  description = "SES domain identity, or null when domain_name is unset."
  value       = module.services.ses_domain_identity_arn
}

output "ses_verification_token" {
  description = "TXT value for _amazonses.<domain>, proving domain ownership to SES."
  value       = module.services.ses_verification_token
}

output "ses_dkim_tokens" {
  description = "DKIM tokens to publish as CNAMEs at <token>._domainkey.<domain>."
  value       = module.services.ses_dkim_tokens
}

output "ses_production_access_notice" {
  description = "SES sandbox limits and how to get out of them. Read before concluding mail is broken."
  value       = module.services.ses_production_access_notice
}

output "task_role_arn" {
  description = "ECS task role — the identity the application's own AWS SDK calls run as."
  value       = module.services.task_role_arn
}

output "task_execution_role_arn" {
  description = "ECS task execution role — image pull, log streams and SSM secret injection."
  value       = module.services.task_execution_role_arn
}
