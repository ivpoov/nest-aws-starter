# ---------------------------------------------------------------------------
# Alarms
#
# All of them are gated on var.alarms_enabled (local.profile.alarms_enabled:
# off on demo, on in production). A CloudWatch alarm is $0.10/month and a
# metric-math one is $0.30, which is not the reason demo goes without — the
# reason is that a demo stack has nobody on call, and an alarm nobody answers
# trains you to ignore the ones that matter.
#
# Every alarm below states treat_missing_data explicitly. The default is
# "missing", which keeps an alarm in its previous state forever when the metric
# stops being published — the exact behaviour you do not want from an alarm
# whose whole job is to notice that something stopped.
# ---------------------------------------------------------------------------

locals {
  alarm_count   = var.alarms_enabled ? 1 : 0
  alarm_actions = [aws_sns_topic.alerts.arn]

  # An ECS/ContainerInsights alarm can only exist where Container Insights does.
  # On a profile without it, HealthyHostCount below is the alarm that answers
  # "are any tasks up?", using metrics the load balancer publishes for free.
  running_task_alarm_count = var.alarms_enabled && var.container_insights_enabled ? 1 : 0

  # FreeStorageSpace is published in bytes.
  database_free_storage_threshold_bytes = floor(
    var.database_allocated_storage_gb * pow(1024, 3) * var.database_free_storage_threshold_percent / 100
  )
}

# ---------------------------------------------------------------------------
# Nothing is running
# ---------------------------------------------------------------------------

# The literal reading of "zero running tasks", and the one that distinguishes
# "the service has no tasks" from "the tasks are up but failing their health
# check". Only available with Container Insights: RunningTaskCount lives in the
# ECS/ContainerInsights namespace, and the free AWS/ECS namespace publishes only
# CPU and memory utilisation, which are absent rather than zero when the service
# is empty.
resource "aws_cloudwatch_metric_alarm" "ecs_no_running_tasks" {
  count = local.running_task_alarm_count

  alarm_name        = var.names.alarms.ecs_no_running_tasks
  alarm_description = "The API service has no running tasks. Check the service events and the stopped-task reasons before anything else — a failed image pull, an unresolvable secret and an OOM kill all land here."

  namespace   = "ECS/ContainerInsights"
  metric_name = "RunningTaskCount"
  statistic   = "Minimum"
  period      = 60

  dimensions = {
    ClusterName = var.ecs_cluster_name
    ServiceName = var.ecs_service_name
  }

  comparison_operator = "LessThanThreshold"
  threshold           = 1
  evaluation_periods  = 3
  datapoints_to_alarm = 2

  # Container Insights stops publishing entirely when there is nothing left to
  # publish about, so silence here means zero, not "unknown".
  treat_missing_data = "breaching"

  alarm_actions = local.alarm_actions
  ok_actions    = local.alarm_actions

  tags = {
    Name = var.names.alarms.ecs_no_running_tasks
    Tier = "observability"
  }
}

# The one that works on every profile. HealthyHostCount is a free AWS/ApplicationELB
# metric and it answers the question users actually care about: is there anything
# behind the load balancer that can serve a request? Zero here covers both no
# tasks at all and tasks that never became healthy.
resource "aws_cloudwatch_metric_alarm" "api_no_healthy_hosts" {
  count = local.alarm_count

  alarm_name        = var.names.alarms.api_no_healthy_hosts
  alarm_description = "No healthy targets behind the API load balancer — every request is being answered with a 503. Either the service has no tasks, or its tasks are failing /api/v1/health/ready."

  namespace   = "AWS/ApplicationELB"
  metric_name = "HealthyHostCount"
  statistic   = "Minimum"
  period      = 60

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
    TargetGroup  = var.target_group_arn_suffix
  }

  comparison_operator = "LessThanThreshold"
  threshold           = 1
  evaluation_periods  = 3
  datapoints_to_alarm = 2

  treat_missing_data = "breaching"

  alarm_actions = local.alarm_actions
  ok_actions    = local.alarm_actions

  tags = {
    Name = var.names.alarms.api_no_healthy_hosts
    Tier = "observability"
  }
}

# ---------------------------------------------------------------------------
# Error rates
# ---------------------------------------------------------------------------

# A rate, not a count. A fixed count of 5xx responses means one thing at ten
# requests a minute and something else entirely at ten thousand, so the alarm
# would have to be retuned every time traffic changed.
#
# Both 5xx sources are summed: HTTPCode_Target_5XX_Count is the application
# answering with a 500, HTTPCode_ELB_5XX_Count is the load balancer answering
# for it (no healthy target, or the target timed out). Watching only the first
# misses the outage.
resource "aws_cloudwatch_metric_alarm" "alb_5xx_rate" {
  count = local.alarm_count

  alarm_name        = var.names.alarms.alb_5xx_rate
  alarm_description = "More than ${var.alb_5xx_rate_threshold_percent}% of API requests are being answered with a 5xx, counting both application 500s and load-balancer-generated ones."

  comparison_operator = "GreaterThanThreshold"
  threshold           = var.alb_5xx_rate_threshold_percent
  evaluation_periods  = 2
  datapoints_to_alarm = 2

  # No traffic means no failures, not an unknown. The no-healthy-hosts alarm is
  # what notices an API that has stopped receiving requests at all.
  treat_missing_data = "notBreaching"

  alarm_actions = local.alarm_actions
  ok_actions    = local.alarm_actions

  metric_query {
    id = "requests"

    metric {
      namespace   = "AWS/ApplicationELB"
      metric_name = "RequestCount"
      stat        = "Sum"
      period      = 300

      dimensions = {
        LoadBalancer = var.alb_arn_suffix
      }
    }
  }

  metric_query {
    id = "target_5xx"

    metric {
      namespace   = "AWS/ApplicationELB"
      metric_name = "HTTPCode_Target_5XX_Count"
      stat        = "Sum"
      period      = 300

      dimensions = {
        LoadBalancer = var.alb_arn_suffix
        TargetGroup  = var.target_group_arn_suffix
      }
    }
  }

  metric_query {
    id = "elb_5xx"

    metric {
      namespace   = "AWS/ApplicationELB"
      metric_name = "HTTPCode_ELB_5XX_Count"
      stat        = "Sum"
      period      = 300

      dimensions = {
        LoadBalancer = var.alb_arn_suffix
      }
    }
  }

  metric_query {
    id          = "error_rate"
    label       = "5xx rate (%)"
    return_data = true

    # The IF is not decoration: a five-minute window with zero requests divides
    # by zero, and CloudWatch treats the result as missing data on an alarm that
    # is meant to stay quiet in exactly that case.
    expression = "IF(requests > 0, 100 * (target_5xx + elb_5xx) / requests, 0)"
  }

  tags = {
    Name = var.names.alarms.alb_5xx_rate
    Tier = "observability"
  }
}

# The application's own view, from the metric filter in logs.tf. It catches what
# the load balancer cannot see: a handler that logs an error and still returns
# 200, a background job failing, a consumer that cannot reach a dependency.
resource "aws_cloudwatch_metric_alarm" "api_error_logs" {
  count = local.alarm_count

  alarm_name        = var.names.alarms.api_error_logs
  alarm_description = "The API logged more than ${var.api_error_log_threshold} error- or fatal-level lines in five minutes. Filter the log group on {$.level = \"error\"} and group by $.context to find the source."

  namespace   = var.error_metric.namespace
  metric_name = var.error_metric.name
  statistic   = "Sum"
  period      = 300

  comparison_operator = "GreaterThanThreshold"
  threshold           = var.api_error_log_threshold
  evaluation_periods  = 1

  treat_missing_data = "notBreaching"

  alarm_actions = local.alarm_actions
  ok_actions    = local.alarm_actions

  tags = {
    Name = var.names.alarms.api_error_logs
    Tier = "observability"
  }

  # The metric does not exist in CloudWatch until the filter has matched a line
  # at least once. Ordering the alarm after the filter does not change that, but
  # it does keep the two from being created and destroyed out of step.
  depends_on = [aws_cloudwatch_log_metric_filter.api_errors]
}

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "database_cpu" {
  count = local.alarm_count

  alarm_name        = var.names.alarms.database_cpu
  alarm_description = "RDS CPU has been above ${var.database_cpu_threshold_percent}% for fifteen minutes. On a t4g burstable class, sustained CPU also drains the credit balance, after which the instance is throttled to its baseline and everything slows down at once."

  namespace   = "AWS/RDS"
  metric_name = "CPUUtilization"
  statistic   = "Average"
  period      = 300

  dimensions = {
    DBInstanceIdentifier = var.database_identifier
  }

  comparison_operator = "GreaterThanThreshold"
  threshold           = var.database_cpu_threshold_percent
  evaluation_periods  = 3

  treat_missing_data = "missing"

  alarm_actions = local.alarm_actions
  ok_actions    = local.alarm_actions

  tags = {
    Name = var.names.alarms.database_cpu
    Tier = "observability"
  }
}

resource "aws_cloudwatch_metric_alarm" "database_free_storage" {
  count = local.alarm_count

  alarm_name        = var.names.alarms.database_free_storage
  alarm_description = "Less than ${var.database_free_storage_threshold_percent}% of the RDS volume is free (${local.database_free_storage_threshold_bytes} bytes). A full volume puts the instance into STORAGE_FULL, where it stops accepting writes — set database_max_allocated_storage_gb to let it autoscale, or grow it by hand now."

  namespace   = "AWS/RDS"
  metric_name = "FreeStorageSpace"
  statistic   = "Minimum"
  period      = 300

  dimensions = {
    DBInstanceIdentifier = var.database_identifier
  }

  comparison_operator = "LessThanThreshold"
  threshold           = local.database_free_storage_threshold_bytes
  evaluation_periods  = 2

  treat_missing_data = "missing"

  alarm_actions = local.alarm_actions
  ok_actions    = local.alarm_actions

  tags = {
    Name = var.names.alarms.database_free_storage
    Tier = "observability"
  }
}

# ---------------------------------------------------------------------------
# Dead letters
# ---------------------------------------------------------------------------

# Above zero, not above some tolerance. A message reaches this queue only after
# the consumer's own attempt accounting has been exhausted *and* SQS's
# maxReceiveCount on top of it (see modules/services/README.md), so a single
# message here is a payment webhook that was never processed. There is no
# healthy number of those.
resource "aws_cloudwatch_metric_alarm" "webhook_dlq_depth" {
  count = local.alarm_count

  alarm_name        = var.names.alarms.webhook_dlq_depth
  alarm_description = "There are messages in the payment webhook dead-letter queue. Each one is a webhook the consumer could not process after every retry; inspect them before redriving, because a redrive of a poison message just refills the queue."

  namespace   = "AWS/SQS"
  metric_name = "ApproximateNumberOfMessagesVisible"
  statistic   = "Maximum"
  period      = 300

  dimensions = {
    QueueName = var.webhook_dlq_name
  }

  comparison_operator = "GreaterThanThreshold"
  threshold           = 0
  evaluation_periods  = 1

  # SQS stops publishing for a queue with no activity, and an idle DLQ is an
  # empty one.
  treat_missing_data = "notBreaching"

  alarm_actions = local.alarm_actions
  ok_actions    = local.alarm_actions

  tags = {
    Name = var.names.alarms.webhook_dlq_depth
    Tier = "observability"
  }
}
