# ---------------------------------------------------------------------------
# ECS cluster and log groups
#
# The cluster itself is free; everything billable hangs off the capacity
# providers and the log groups below.
# ---------------------------------------------------------------------------

resource "aws_ecs_cluster" "this" {
  name = var.names.ecs_cluster

  setting {
    # Per-metric CloudWatch billing, so it follows the profile rather than being
    # on by default. Off, the cluster still emits the free CloudWatch metrics
    # (CPU/memory utilisation) that the autoscaling policy in autoscaling.tf
    # scales on — Container Insights buys per-task and per-container granularity,
    # not the ability to scale.
    name  = "containerInsights"
    value = var.container_insights_enabled ? "enabled" : "disabled"
  }

  tags = {
    Name = var.names.ecs_cluster
    Tier = "compute"
  }
}

# Both providers are attached whichever one the service uses, so switching
# use_fargate_spot is a service change rather than a cluster change — and so a
# task can be launched on on-demand FARGATE explicitly even on a Spot stack,
# which is what the migration task does.
resource "aws_ecs_cluster_capacity_providers" "this" {
  cluster_name       = aws_ecs_cluster.this.name
  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  # The cluster default only applies to a task launched with neither a launch
  # type nor a strategy of its own. The service states its own strategy (see
  # service.tf) and the deploy workflow states one for the migration task, so
  # this is a fallback for hand-run tasks rather than the operative setting.
  default_capacity_provider_strategy {
    capacity_provider = local.capacity_provider
    weight            = 100
    base              = 0
  }
}

locals {
  capacity_provider = var.use_fargate_spot ? "FARGATE_SPOT" : "FARGATE"
}

# ---------------------------------------------------------------------------
# Log groups
#
# Declared here, not left to the awslogs driver. A group the driver creates has
# retention "never expire" and bills for the life of the account; the execution
# role in the services module deliberately withholds logs:CreateLogGroup so that
# cannot happen by accident. Both names sit under the /aws/ecs/<prefix> path the
# execution role's CreateLogStream statement is scoped to.
# ---------------------------------------------------------------------------

resource "aws_cloudwatch_log_group" "api" {
  name              = var.names.api_log_group
  retention_in_days = var.log_retention_days

  tags = {
    Name = var.names.api_log_group
    Tier = "compute"
  }
}

resource "aws_cloudwatch_log_group" "migrations" {
  name              = var.names.migrations_log_group
  retention_in_days = var.log_retention_days

  tags = {
    Name = var.names.migrations_log_group
    Tier = "compute"
  }
}
