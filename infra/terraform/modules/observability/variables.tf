# This module takes resolved values, never a cost profile. The root stack reads
# local.profile.<key> and local.names and hands the results down, so there is no
# `var.cost_profile` comparison anywhere below this line — see the root
# locals.tf for why that rule exists.

# ---------------------------------------------------------------------------
# Names
# ---------------------------------------------------------------------------

variable "names" {
  description = "Every name this module creates, resolved by the root stack. Nothing here is built from a prefix inside the module."
  type = object({
    alerts_topic        = string
    budget              = string
    error_metric_filter = string
    access_logs_bucket  = string
    alarms = object({
      api_no_healthy_hosts  = string
      ecs_no_running_tasks  = string
      alb_5xx_rate          = string
      api_error_logs        = string
      database_cpu          = string
      database_free_storage = string
      webhook_dlq_depth     = string
    })
  })
}

# ---------------------------------------------------------------------------
# Alerting
# ---------------------------------------------------------------------------

variable "alert_email" {
  description = "Address subscribed to the alert topic, or null. AWS mails a confirmation that must be clicked before anything is delivered — an unconfirmed subscription looks identical to a working one in the console."
  type        = string
  default     = null
}

variable "alarms_enabled" {
  description = "Whether the CloudWatch alarms are created. Comes from local.profile.alarms_enabled. The metric filter, the topic and the budget are created either way — see README.md for why those three are not profile-dependent."
  type        = bool
}

# ---------------------------------------------------------------------------
# Log retention
# ---------------------------------------------------------------------------

variable "log_retention_days" {
  description = "Retention for the log groups this module owns. Comes from local.profile.log_retention_days (7 on demo, 30 on production). The ECS task log groups are not here — the compute module already declares them with the same value."
  type        = number

  validation {
    condition     = var.log_retention_days > 0
    error_message = "log_retention_days must be positive — a log group with no retention keeps every byte forever and bills for it forever."
  }
}

variable "container_insights_enabled" {
  description = "Whether the ECS cluster runs Container Insights. When it does, ECS publishes a performance log group that it creates itself, with retention set to never expire; this module declares it up front so that cannot happen."
  type        = bool
}

# ---------------------------------------------------------------------------
# Targets the alarms are written against
#
# Every one of these is an output of an earlier module rather than a name this
# module rebuilds. An alarm pointed at a dimension value that does not exist is
# not an error in CloudWatch — it is a permanently INSUFFICIENT_DATA alarm that
# reads as coverage.
# ---------------------------------------------------------------------------

variable "api_log_group_name" {
  description = "Log group the API container writes to, from the compute module. The error metric filter is attached to this group."
  type        = string
}

variable "ecs_cluster_name" {
  description = "ECS cluster name, for the ECS/ContainerInsights dimensions."
  type        = string
}

variable "ecs_service_name" {
  description = "ECS service name, for the ECS/ContainerInsights dimensions."
  type        = string
}

variable "alb_arn_suffix" {
  description = "Load balancer ARN suffix, in the form the AWS/ApplicationELB LoadBalancer dimension takes."
  type        = string
}

variable "target_group_arn_suffix" {
  description = "API target group ARN suffix, in the form the AWS/ApplicationELB TargetGroup dimension takes."
  type        = string
}

variable "database_identifier" {
  description = "RDS instance identifier, for the AWS/RDS DBInstanceIdentifier dimension."
  type        = string
}

variable "database_allocated_storage_gb" {
  description = "Allocated storage of the RDS instance. The free-storage alarm threshold is a percentage of this rather than a fixed byte count, so it stays meaningful when the instance is resized."
  type        = number
}

variable "webhook_dlq_name" {
  description = "Name of the payment webhook dead-letter queue, for the AWS/SQS QueueName dimension."
  type        = string
}

variable "error_metric" {
  description = "Namespace and name of the custom metric the log filter publishes. Kept out of the AWS/* namespaces, which are reserved."
  type = object({
    namespace = string
    name      = string
  })
}

# ---------------------------------------------------------------------------
# Alarm thresholds
#
# Defaults, not policy. Each one is the point at which a human should look, not
# the point at which the service is down.
# ---------------------------------------------------------------------------

variable "alb_5xx_rate_threshold_percent" {
  description = "Percentage of requests answered with a 5xx (target or load balancer) that trips the ALB alarm."
  type        = number
  default     = 5

  validation {
    condition     = var.alb_5xx_rate_threshold_percent > 0 && var.alb_5xx_rate_threshold_percent <= 100
    error_message = "alb_5xx_rate_threshold_percent must be between 0 (exclusive) and 100."
  }
}

variable "database_cpu_threshold_percent" {
  description = "Average RDS CPU utilisation that trips the database alarm."
  type        = number
  default     = 85

  validation {
    condition     = var.database_cpu_threshold_percent > 0 && var.database_cpu_threshold_percent <= 100
    error_message = "database_cpu_threshold_percent must be between 0 (exclusive) and 100."
  }
}

variable "database_free_storage_threshold_percent" {
  description = "Share of allocated storage still free that trips the storage alarm. A full RDS volume is the one database failure with no partial mode: the instance goes to STORAGE_FULL and stops accepting writes."
  type        = number
  default     = 15

  validation {
    condition     = var.database_free_storage_threshold_percent > 0 && var.database_free_storage_threshold_percent < 100
    error_message = "database_free_storage_threshold_percent must be between 0 and 100, exclusive."
  }
}

variable "api_error_log_threshold" {
  description = "Number of error-level log lines in five minutes that trips the application error alarm. Above zero on purpose: a single handled error is normal traffic, a burst is not."
  type        = number
  default     = 10

  validation {
    condition     = var.api_error_log_threshold >= 1
    error_message = "api_error_log_threshold must be at least 1."
  }
}

# ---------------------------------------------------------------------------
# Budget
# ---------------------------------------------------------------------------

variable "monthly_budget_amount_usd" {
  description = "Monthly cost budget in USD. Not profile-dependent and not optional — this is the backstop for a stack nobody remembered to destroy."
  type        = number

  validation {
    condition     = var.monthly_budget_amount_usd > 0
    error_message = "monthly_budget_amount_usd must be greater than zero."
  }
}

variable "budget_actual_thresholds_percent" {
  description = "Percentages of the budget that raise an alert once actually spent."
  type        = list(number)
  default     = [50, 80, 100]

  validation {
    condition     = length(var.budget_actual_thresholds_percent) > 0
    error_message = "budget_actual_thresholds_percent must list at least one threshold, or the budget alerts nobody."
  }
}

# ---------------------------------------------------------------------------
# Access-log bucket
# ---------------------------------------------------------------------------

variable "access_logs_bucket_enabled" {
  description = "Create the shared access-log bucket, and with it the bucket policy that lets the load balancer deliver into it. Driven by local.profile.access_logs_enabled, the same key that turns both writers on — an empty bucket nobody writes to is a resource no one can explain later."
  type        = bool
}

variable "alb_log_delivery_uses_regional_account" {
  description = <<-EOT
    Whether ALB access logs are delivered by the per-Region ELB account rather
    than by the logdelivery.elasticloadbalancing.amazonaws.com service principal.

    True for every Region launched before August 2022 — us-east-1, eu-west-1,
    ap-southeast-2 and the rest of the familiar list — which is why it defaults
    to true. Set it to false in a Region launched from August 2022 onward
    (eu-central-2, me-central-1, il-central-1, ap-south-2, ca-west-1, …): those
    deliver as the service principal, which the bucket policy grants either way,
    and data.aws_elb_service_account has no entry for them, so leaving this true
    fails the plan rather than the apply.
  EOT
  type        = bool
  default     = true
}

variable "access_logs_retention_days" {
  description = "How long delivered access logs are kept before the lifecycle rule expires them. CloudFront delivers to this bucket continuously; without an expiry it grows without bound."
  type        = number
  default     = 90

  validation {
    condition     = var.access_logs_retention_days >= 1
    error_message = "access_logs_retention_days must be at least 1."
  }
}

variable "access_logs_force_destroy" {
  description = "Whether `terraform destroy` may delete the access-log bucket with objects still in it. Comes from local.profile.force_destroy_bucket."
  type        = bool
  default     = false
}
