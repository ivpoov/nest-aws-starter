# ---------------------------------------------------------------------------
# Log groups
#
# The ECS task log groups are NOT here. modules/compute/cluster.tf already
# declares /aws/ecs/<prefix>/api and /aws/ecs/<prefix>/migrations with
# retention_in_days = local.profile.log_retention_days, and the services module
# withholds logs:CreateLogGroup from the execution role so the awslogs driver
# cannot create an unretained one behind their back. Declaring them a second
# time here would be a duplicate resource address for the same log group and a
# guaranteed "already exists" on apply.
#
# What is left is the one log group nothing declares and AWS creates for you.
# ---------------------------------------------------------------------------

locals {
  # Fixed by AWS, not by us: the ECS agent writes Container Insights performance
  # events to exactly this path and there is no setting that moves it. Creating
  # it here first is the only way it ever gets a retention policy — the group ECS
  # creates on the first task launch has retention "never expire", which is the
  # slow, invisible kind of cost this whole file exists to prevent.
  container_insights_log_group = "/aws/ecs/containerinsights/${var.ecs_cluster_name}/performance"
}

resource "aws_cloudwatch_log_group" "container_insights" {
  count = var.container_insights_enabled ? 1 : 0

  name              = local.container_insights_log_group
  retention_in_days = var.log_retention_days

  tags = {
    Name = local.container_insights_log_group
    Tier = "observability"
  }
}

# ---------------------------------------------------------------------------
# Error metric filter
#
# apps/api/src/modules/logger/services/custom-logger.service.ts overrides
# ConsoleLogger.printMessages and, when NODE_ENV is "production" (which
# compute.tf sets on the task), writes one JSON object per line and nothing
# else. The shape is LogEntryInterface:
#
#   {"level":"error","context":"PaymentService","message":"…",
#    "timestamp":"2026-01-01T00:00:00.000Z","requestId":"…"}
#
# `level` is a Nest LogLevel verbatim — one of verbose|debug|log|warn|error|
# fatal — so the two values worth alarming on are "error" and "fatal", and
# neither is capitalised. `requestId` is present only inside a request scope,
# which is why the filter does not reference it.
#
# The pattern below is a CloudWatch *JSON* filter, which only matches log events
# that parse as JSON. That is deliberate and it is also the known gap: the lines
# Node writes before app.useLogger() runs in main.ts, and an uncaught exception's
# stack trace, are plain text and will never match. Those are startup and crash
# signals; the no-healthy-hosts alarm is what covers them.
# ---------------------------------------------------------------------------

resource "aws_cloudwatch_log_metric_filter" "api_errors" {
  name           = var.names.error_metric_filter
  log_group_name = var.api_log_group_name
  pattern        = "{ $.level = \"error\" || $.level = \"fatal\" }"

  metric_transformation {
    name      = var.error_metric.name
    namespace = var.error_metric.namespace
    value     = "1"
    unit      = "Count"

    # Emit a zero for every log line that does not match. Without it the metric
    # has no datapoints at all while the service is healthy, and the alarm sits
    # in INSUFFICIENT_DATA rather than OK — indistinguishable, at a glance, from
    # an alarm watching a metric that does not exist.
    default_value = "0"
  }
}

# The filter is created on both profiles even though the alarms are not. It is
# free, it starts accumulating the metric immediately, and having the history
# already there is the difference between diagnosing an incident and starting to
# measure during one.
