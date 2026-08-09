# ---------------------------------------------------------------------------
# Autoscaling
#
# Target tracking on average CPU. Application Auto Scaling maintains the two
# CloudWatch alarms behind it; there is no step policy, no scheduled action and
# no custom metric to keep in step.
#
# The reason this matters is not only the bill. Two pieces of apps/api only
# *mean* anything above one task:
#
#   - the scheduler takes a Redis lock before each run, so that N tasks produce
#     one execution rather than N. At one task the lock is always uncontended
#     and a bug in it is invisible.
#   - the Socket.IO Redis adapter fans broadcasts out across tasks. At one task
#     every subscriber is local and the adapter is never exercised.
#
# A profile whose ceiling is one task therefore never runs either code path, and
# the first time it does is in front of users. Raising max_capacity above one is
# what turns them on — and it is also what the data module reads to decide that
# Redis must be a shared service rather than a task-local sidecar, because two
# tasks with two sidecars would disagree about who is logged in.
# ---------------------------------------------------------------------------

resource "aws_appautoscaling_target" "api" {
  count = var.autoscaling_enabled ? 1 : 0

  service_namespace  = "ecs"
  scalable_dimension = "ecs:service:DesiredCount"
  resource_id        = "service/${aws_ecs_cluster.this.name}/${aws_ecs_service.api.name}"

  min_capacity = var.min_capacity
  max_capacity = var.max_capacity
}

resource "aws_appautoscaling_policy" "api_cpu" {
  count = var.autoscaling_enabled ? 1 : 0

  name               = var.names.autoscaling_cpu_policy
  policy_type        = "TargetTrackingScaling"
  service_namespace  = aws_appautoscaling_target.api[0].service_namespace
  scalable_dimension = aws_appautoscaling_target.api[0].scalable_dimension
  resource_id        = aws_appautoscaling_target.api[0].resource_id

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      # The service-level average across running tasks, published free by ECS.
      # Container Insights is not required for this metric and the policy works
      # identically whether it is enabled or not.
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }

    target_value = var.autoscaling_target_cpu_percent

    # Asymmetric on purpose. Adding a task costs a few cents an hour and buys
    # headroom immediately; removing one costs nothing until the load comes back
    # and the replacement has to boot from cold. So: scale out promptly, scale in
    # reluctantly.
    scale_out_cooldown = var.autoscaling_scale_out_cooldown_seconds
    scale_in_cooldown  = var.autoscaling_scale_in_cooldown_seconds

    # Scale-in stays enabled. Disabling it is the usual way a stack that scaled
    # out once during a load test keeps billing for the extra tasks for a month.
    disable_scale_in = false
  }
}
