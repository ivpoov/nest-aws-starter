output "uploads_bucket_name" {
  description = "Name of the uploads bucket. Goes to the API as S3_BUCKET_NAME."
  value       = aws_s3_bucket.uploads.bucket
}

output "uploads_bucket_arn" {
  description = "ARN of the uploads bucket."
  value       = aws_s3_bucket.uploads.arn
}

output "uploads_bucket_regional_domain_name" {
  description = "Regional domain name of the uploads bucket, for a CloudFront origin."
  value       = aws_s3_bucket.uploads.bucket_regional_domain_name
}

output "payment_webhook_queue_url" {
  description = "URL of the payment webhook queue. Goes to the API as SQS_PAYMENT_WEBHOOK_QUEUE_URL."
  value       = aws_sqs_queue.webhook.url
}

output "payment_webhook_queue_arn" {
  description = "ARN of the payment webhook queue."
  value       = aws_sqs_queue.webhook.arn
}

output "payment_webhook_dlq_url" {
  description = "URL of the payment webhook dead-letter queue. Nothing in the application reads it; draining it is an operator action."
  value       = aws_sqs_queue.webhook_dlq.url
}

output "payment_webhook_dlq_arn" {
  description = "ARN of the payment webhook dead-letter queue. The observability stack should alarm on its ApproximateNumberOfMessagesVisible — a DLQ nobody watches is a folder of lost payments."
  value       = aws_sqs_queue.webhook_dlq.arn
}

output "payment_webhook_max_receive_count" {
  description = "Receives before a message is dead-lettered. Tracks MAX_WEBHOOK_ATTEMPTS in the API's webhook consumer — see sqs.tf."
  value       = var.webhook_max_receive_count
}

output "notifications_topic_arn" {
  description = "ARN of the application notification topic."
  value       = aws_sns_topic.notifications.arn
}

output "ses_domain_identity_arn" {
  description = "ARN of the SES domain identity, or null when no mail domain is configured."
  value       = local.ses_enabled ? aws_ses_domain_identity.mail[0].arn : null
}

output "ses_verification_token" {
  description = "Value for the _amazonses TXT record that proves you own the domain. Null when no mail domain is configured."
  value       = var.mail_domain == null ? null : aws_ses_domain_identity.mail[0].verification_token
}

output "ses_dkim_tokens" {
  description = "Three DKIM tokens. Publish each as a CNAME <token>._domainkey.<domain> -> <token>.dkim.amazonses.com. Empty when no mail domain is configured."
  value       = var.mail_domain == null ? [] : aws_ses_domain_dkim.mail[0].dkim_tokens
}

output "ses_production_access_notice" {
  description = "Read this before concluding that mail is broken."
  value       = <<-EOT
    SES starts every new AWS account in the SANDBOX. Verifying this domain does
    not change that.

    In the sandbox you may only send to addresses or domains you have separately
    verified, capped at 200 messages a day and 1 message a second. Mail to an
    unverified recipient is rejected with MessageRejected and never reaches an
    inbox.

    To leave the sandbox: AWS console -> Amazon SES -> Account dashboard ->
    "Request production access". AWS reviews the request by hand, usually within
    24 hours. There is no Terraform resource for this and there is no API for it
    either.
  EOT
}

output "task_role_arn" {
  description = "ARN of the ECS task role — set this as the task definition's task_role_arn."
  value       = aws_iam_role.task.arn
}

output "task_role_name" {
  description = "Name of the ECS task role, for attaching further policies from other stacks."
  value       = aws_iam_role.task.name
}

output "task_execution_role_arn" {
  description = "ARN of the ECS task execution role — set this as the task definition's execution_role_arn."
  value       = aws_iam_role.task_execution.arn
}

output "task_execution_role_name" {
  description = "Name of the ECS task execution role, for attaching further policies from other stacks."
  value       = aws_iam_role.task_execution.name
}
