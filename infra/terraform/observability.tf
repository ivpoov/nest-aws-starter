# ---------------------------------------------------------------------------
# Observability — retention, an error metric, alarms, the alert topic, the
# access-log bucket, and the monthly budget.
#
# Everything the module needs is resolved here, from local.profile, local.names
# and the network, data, services and compute modules' outputs. The module
# itself never sees var.cost_profile.
#
# Two things in here are deliberately NOT profile-dependent:
#
#   - the error metric filter, because it is free and its value is the history
#     it has already accumulated by the time anyone wants it;
#   - the budget, because the risk this whole stage introduces is not an
#     application failure, it is a stack that is still running next month.
#
# The alarms themselves are profile-gated: a demo stack has nobody on call.
# ---------------------------------------------------------------------------

variable "monthly_budget_amount_usd" {
  description = <<-EOT
    Monthly cost budget in USD, alerted at 50/80/100% of actual spend and once
    on a forecast to exceed it.

    $20 is a deliberate default rather than a generous one: the demo profile is
    designed to land near $15-25/month (RDS db.t4g.micro, one Fargate task, an
    ALB, two CloudFront distributions), so the first alert arrives while the
    stack is behaving normally and confirms the budget works. Raise it once you
    know what your own posture costs — but raise it consciously, because a
    budget set high enough never to fire is the same as no budget.

    The budget is account-wide and has no cost filter. See modules/observability/
    budget.tf for why filtering it to this stack's tags would quietly report zero.
  EOT
  type        = number
  default     = 20

  validation {
    condition     = var.monthly_budget_amount_usd >= 1
    error_message = "monthly_budget_amount_usd must be at least 1 — a budget of zero alerts on the first cent and is ignored from then on."
  }
}

variable "alb_log_delivery_uses_regional_account" {
  description = <<-EOT
    Which AWS identity delivers the load balancer's access logs, and therefore
    which statement the log bucket's policy needs. Region-dependent, and there is
    no way for Terraform to work it out on its own.

    Leave it true in any Region launched before August 2022 — us-east-1,
    eu-west-1, ap-southeast-2 and every other familiar id — where delivery comes
    from a per-Region ELB account that `data.aws_elb_service_account` resolves.

    Set it to false in a Region launched from August 2022 onward (eu-central-2,
    me-central-1, il-central-1, ap-south-2, ca-west-1, …). Those deliver as
    `logdelivery.elasticloadbalancing.amazonaws.com`, which the policy grants
    unconditionally, and `data.aws_elb_service_account` has no entry for them —
    so leaving it true fails the plan rather than the apply.

    Only read when the profile creates the access-log bucket.
  EOT
  type        = bool
  default     = true
}

locals {
  # Reshaped from local.names, not derived here — the module wants the alarm
  # names grouped and local.names is deliberately flat. The custom metric
  # namespace below is the one thing in this file that is not a resource name,
  # which is why it is not in that map.
  observability_names = {
    alerts_topic        = local.names.alerts_topic
    budget              = local.names.budget
    error_metric_filter = local.names.error_metric_filter
    access_logs_bucket  = local.names.logs_bucket

    alarms = {
      api_no_healthy_hosts  = local.names.alarm_api_no_healthy_hosts
      ecs_no_running_tasks  = local.names.alarm_ecs_no_running_tasks
      alb_5xx_rate          = local.names.alarm_alb_5xx_rate
      api_error_logs        = local.names.alarm_api_error_logs
      database_cpu          = local.names.alarm_database_cpu
      database_free_storage = local.names.alarm_database_free_storage
      webhook_dlq_depth     = local.names.alarm_webhook_dlq_depth
    }
  }

  # Custom metric published by the log filter. Not an AWS/* namespace — those are
  # reserved, and CloudWatch silently drops writes to them. Scoped per
  # environment so a dev and a prod stack in one account do not sum into the
  # same series.
  observability_error_metric = {
    namespace = "${var.project_name}/${var.environment}"
    name      = "ApiErrorLogEvents"
  }

  # The AWS/SQS QueueName dimension takes a name, and the services module exports
  # ARNs. Splitting the ARN rather than reusing local.names.payment_webhook_dlq is the
  # difference between an alarm bound to the queue that exists and an alarm bound
  # to a name that is supposed to match it: this way there is a real dependency
  # edge, and a rename cannot leave the alarm pointing at nothing.
  observability_webhook_dlq_name = element(split(":", module.services.payment_webhook_dlq_arn), 5)

  # The same profile key the edge module's logging_enabled reads and the same one
  # the compute module's access_logs takes, so the bucket and the two things that
  # deliver into it can never disagree about whether it exists. edge.tf consumes
  # access_logs_bucket_domain_name from this module; compute.tf consumes
  # alb_access_logs.
  observability_access_logs_enabled = local.profile.access_logs_enabled
}

module "observability" {
  source = "./modules/observability"

  names = local.observability_names

  alert_email    = var.alert_email
  alarms_enabled = local.profile.alarms_enabled

  # The same retention every other log group in the stack uses — 7 days on demo,
  # 30 in production.
  log_retention_days         = local.profile.log_retention_days
  container_insights_enabled = local.profile.container_insights

  # Alarm targets, every one of them an output rather than a rebuilt name. The
  # ARN *suffixes* are what CloudWatch's ApplicationELB dimensions take; the full
  # ARN does not match and produces an alarm that never leaves INSUFFICIENT_DATA.
  api_log_group_name      = module.compute.log_group_names["api"]
  ecs_cluster_name        = module.compute.cluster_name
  ecs_service_name        = module.compute.service_name
  alb_arn_suffix          = module.compute.alb_arn_suffix
  target_group_arn_suffix = module.compute.target_group_arn_suffix

  database_identifier           = module.data.database_identifier
  database_allocated_storage_gb = local.profile.database_allocated_storage_gb

  webhook_dlq_name = local.observability_webhook_dlq_name

  error_metric = local.observability_error_metric

  # Not gated on anything. This is the safety net for the stack nobody destroyed.
  monthly_budget_amount_usd = var.monthly_budget_amount_usd

  access_logs_bucket_enabled = local.observability_access_logs_enabled
  access_logs_retention_days = local.profile.log_retention_days
  access_logs_force_destroy  = local.profile.force_destroy_bucket

  alb_log_delivery_uses_regional_account = var.alb_log_delivery_uses_regional_account
}

# ---------------------------------------------------------------------------
# Preflight warnings (soft — hard errors belong in variable validation)
# ---------------------------------------------------------------------------

check "budget_without_a_recipient" {
  assert {
    # The budget is created regardless, and it is still worth having: the spend
    # is visible in the Budgets console either way. But the scenario it exists
    # for — a stack left running by someone who has stopped looking at the
    # console — is exactly the one where an unsent notification is worthless.
    condition = var.alert_email != null
    error_message = join(" ", [
      "A monthly cost budget is created, but alert_email is unset, so it notifies nobody.",
      "The budget exists to catch a stack that was never destroyed; that only works if the alert reaches someone who has stopped looking at the console.",
      "Set alert_email, or add a subscriber by hand in the AWS Budgets console.",
    ])
  }
}

# ---------------------------------------------------------------------------
# Outputs
# ---------------------------------------------------------------------------

output "alerts_topic_arn" {
  description = "Topic every CloudWatch alarm publishes to. Separate from notifications_topic_arn, which is the application's own event topic — alarms and application events do not share a fan-out."
  value       = module.observability.alerts_topic_arn
}

output "alerts_subscription_notice" {
  description = "What still has to happen by hand before an alarm reaches a human."
  value = module.observability.alert_subscription_pending ? join(" ", [
    "AWS has emailed a subscription confirmation to the address in alert_email.",
    "Until the link in it is clicked the subscription stays PendingConfirmation and every alarm publishes into a topic with no confirmed endpoint.",
    ]) : join(" ", [
    "No alert_email is set, so nothing is subscribed to the alert topic and no alarm or budget notification reaches anyone.",
    "Set alert_email, or run: aws sns subscribe --topic-arn <alerts_topic_arn> --protocol email --notification-endpoint you@example.com",
  ])
}

output "alarm_names" {
  description = "CloudWatch alarms that exist on this profile, by role. Empty when the profile disables alarms — read it rather than assuming the set."
  value       = module.observability.alarm_names
}

output "api_error_metric" {
  description = "The custom metric the API's error-level log lines are counted into, and the filter pattern that produces it. The pattern is written against the JSON the structured logger emits in production — see modules/observability/logs.tf."
  value       = module.observability.error_metric
}

output "observability_log_group_names" {
  description = "Log groups this stack declares on top of the ECS ones, by role. Container Insights writes to a group AWS creates itself with retention set to never expire; declaring it first is what gives it one."
  value       = module.observability.log_group_names
}

output "monthly_budget" {
  description = "The monthly cost budget: its name, its limit in USD, and whether anyone is subscribed to it."
  value = {
    name           = module.observability.budget_name
    limit_usd      = module.observability.budget_limit_usd
    notifies       = var.alert_email == null ? "nobody" : "alert_email"
    account_scoped = true
  }
}

output "access_logs_bucket_name" {
  description = "Shared access-log bucket, or null when the profile does not ask for access logs. Two writers deliver into it: CloudFront under cloudfront/<site>/ and the load balancer under alb/AWSLogs/<account-id>/elasticloadbalancing/<region>/."
  value       = module.observability.access_logs_bucket_name
}

output "alb_access_logs" {
  description = "Whether the load balancer delivers access logs, and the bucket and prefix it delivers to. ELB batches to S3 roughly every five minutes, so an empty prefix shortly after an apply is expected rather than a failure."
  value       = module.observability.alb_access_logs
}

output "access_logs_bucket_domain_name" {
  description = "Regional domain name of the access-log bucket, or null when the profile does not ask for edge logging. This is what edge.tf passes to the edge module as log_bucket_domain_name."
  value       = module.observability.access_logs_bucket_domain_name
}
