output "alerts_topic_arn" {
  description = "Alert topic every alarm publishes to. Distinct from the application notification topic the services module owns — see alerts.tf."
  value       = aws_sns_topic.alerts.arn
}

output "alerts_topic_name" {
  description = "Name of the alert topic, for `aws sns subscribe` when a second destination is added by hand."
  value       = aws_sns_topic.alerts.name
}

output "alert_subscription_pending" {
  description = "True when an email subscription exists that AWS has mailed a confirmation link for. It does not turn false once confirmed — Terraform cannot see the confirmation. Treat it as \"check your inbox\", not as a status."
  value       = length(aws_sns_topic_subscription.alert_email) > 0
}

output "alarm_names" {
  description = "Every alarm that was actually created, by role. Empty on a profile with alarms disabled — read this rather than assuming, because the set differs by profile."
  value = {
    for role, name in {
      api_no_healthy_hosts  = one(aws_cloudwatch_metric_alarm.api_no_healthy_hosts[*].alarm_name)
      ecs_no_running_tasks  = one(aws_cloudwatch_metric_alarm.ecs_no_running_tasks[*].alarm_name)
      alb_5xx_rate          = one(aws_cloudwatch_metric_alarm.alb_5xx_rate[*].alarm_name)
      api_error_logs        = one(aws_cloudwatch_metric_alarm.api_error_logs[*].alarm_name)
      database_cpu          = one(aws_cloudwatch_metric_alarm.database_cpu[*].alarm_name)
      database_free_storage = one(aws_cloudwatch_metric_alarm.database_free_storage[*].alarm_name)
      webhook_dlq_depth     = one(aws_cloudwatch_metric_alarm.webhook_dlq_depth[*].alarm_name)
    } : role => name if name != null
  }
}

output "error_metric" {
  description = "Namespace, name and filter pattern of the application error metric, so the pattern can be pasted straight into a Logs Insights query when an alarm fires."
  value = {
    namespace = var.error_metric.namespace
    name      = var.error_metric.name
    pattern   = aws_cloudwatch_log_metric_filter.api_errors.pattern
  }
}

output "log_group_names" {
  description = "Log groups this module owns, by role. The ECS task and migration groups are not here — the compute module declares those."
  value = {
    for role, name in {
      container_insights = one(aws_cloudwatch_log_group.container_insights[*].name)
    } : role => name if name != null
  }
}

output "budget_name" {
  description = "Monthly cost budget. Created on every profile."
  value       = aws_budgets_budget.monthly.name
}

output "budget_limit_usd" {
  description = "Monthly limit the budget alerts against, in USD."
  value       = aws_budgets_budget.monthly.limit_amount
}

output "access_logs_bucket_name" {
  description = "Shared access-log bucket, or null when the profile does not ask for edge logging."
  value       = one(aws_s3_bucket.access_logs[*].bucket)
}

output "access_logs_bucket_domain_name" {
  description = "Regional domain name of the access-log bucket, in the form CloudFront's logging_config takes. This is the value edge.tf's local.edge_log_bucket_domain_name is waiting for."
  value       = one(aws_s3_bucket.access_logs[*].bucket_regional_domain_name)
}
