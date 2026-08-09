# ---------------------------------------------------------------------------
# Services: uploads bucket, payment webhook queue + DLQ, notification topic,
# SES identity, and the two ECS task roles.
#
# Everything the module needs is resolved here — names from local.names, the
# cost/durability knob from local.profile — so nothing below the module boundary
# ever sees var.cost_profile.
# ---------------------------------------------------------------------------

locals {
  # Origins allowed to run a presigned PUT from a browser. With a custom domain
  # this is exact. Without one, the frontend is served from a CloudFront
  # hostname AWS assigns at apply time in the edge stack, which is not knowable
  # here — hence the wildcard, which is a browser-side control and not an
  # authorization one: the presigned signature is what authorizes the upload,
  # and it expires in minutes. Set domain_name to narrow it.
  uploads_cors_allowed_origins = var.domain_name == null ? ["*"] : [
    "https://${var.domain_name}",
    "https://www.${var.domain_name}",
  ]

  # No mail domain means no SES identity and no ses:SendEmail on the task role:
  # there is nothing to verify and nowhere legitimate to send from. Change the
  # local part here if your transactional mail should come from something other
  # than no-reply@.
  mail_from_address = var.domain_name == null ? null : "no-reply@${var.domain_name}"

  # local.names has one log group per service (api_log_group, web_log_group);
  # the execution role is scoped to their shared prefix so it does not need
  # widening every time a service is added.
  ecs_log_group_prefix = "/aws/ecs/${local.name_prefix}"
}

module "services" {
  source = "./modules/services"

  uploads_bucket_name          = local.names.uploads_bucket
  uploads_bucket_force_destroy = local.profile.force_destroy_bucket
  uploads_cors_allowed_origins = local.uploads_cors_allowed_origins

  # local.names.events_* — the queue currently carries payment webhook events;
  # the naming is deliberately event-shaped so a second producer does not need a
  # second queue.
  webhook_queue_name = local.names.events_queue
  webhook_dlq_name   = local.names.events_dlq

  notifications_topic_name = local.names.events_topic

  mail_domain       = var.domain_name
  mail_from_address = local.mail_from_address

  task_role_name           = local.names.task_role
  task_execution_role_name = local.names.task_execution_role
  ecr_repository_names     = [local.names.ecr_api, local.names.ecr_web]
  log_group_name_prefix    = local.ecs_log_group_prefix
  ssm_parameter_prefix     = local.secret_prefix
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
