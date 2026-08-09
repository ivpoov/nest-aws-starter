# ---------------------------------------------------------------------------
# ECS service
# ---------------------------------------------------------------------------

resource "aws_ecs_service" "api" {
  name            = var.names.ecs_service_api
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.desired_count

  # Rolling update, stated rather than inherited. The alternatives are
  # CODE_DEPLOY (blue/green, needs a second target group and a deployment group)
  # and EXTERNAL (bring your own orchestrator); both are real answers to
  # questions this stack does not have.
  deployment_controller {
    type = "ECS"
  }

  # ---------------------------------------------------------------------
  # Circuit breaker.
  #
  # Without it, a task definition that cannot start — a bad image tag, a missing
  # SSM parameter, a syntax error in the entrypoint — leaves ECS retrying the
  # new task indefinitely while the deployment sits IN_PROGRESS. The workflow
  # that triggered it reports success, because `update-service` returned 200,
  # and nobody finds out until someone looks at the console.
  #
  # With it, ECS counts consecutive failed task launches and gives up. rollback
  # then puts the previous task definition back automatically, so the service is
  # running the last version that worked rather than nothing at all.
  # ---------------------------------------------------------------------
  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  # 100/200: start the replacement before stopping the incumbent, so a
  # single-task service has no gap. The cost is that a deploy briefly runs twice
  # the task count — which is why the connection-pool check in datastores.tf
  # budgets for it, and why a sidecar-cache stack briefly has two caches during a
  # deploy (the data module's README calls that out as the sidecar's price).
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  # Do not count load balancer health against a task for this long after it
  # reaches RUNNING. Image pull happens before RUNNING, so this covers Nest
  # bootstrap and the first Prisma connection only. Too short and a slow-booting
  # task is killed and retried forever; too long and a genuinely broken deploy
  # takes minutes to be recognised.
  health_check_grace_period_seconds = var.health_check_grace_period_seconds

  capacity_provider_strategy {
    capacity_provider = local.capacity_provider
    weight            = 100
  }

  network_configuration {
    subnets         = var.workload_subnet_ids
    security_groups = [var.api_security_group_id]

    # ---------------------------------------------------------------
    # The no-NAT consequence, stated plainly.
    #
    # A Fargate task pulls its image from ECR, writes to CloudWatch Logs and
    # resolves its SSM secrets over the public AWS endpoints. It needs a route
    # to them. There are exactly three ways to have one:
    #
    #   1. a NAT gateway (~$32/month per gateway, before data processing);
    #   2. interface VPC endpoints for ecr.api, ecr.dkr, logs, ssm and s3
    #      (~$7/month per endpoint per AZ); or
    #   3. a public IP on the task itself, which is free.
    #
    # The demo profile takes the third, which is why its workloads sit in public
    # subnets at all. A public IP is not exposure: the API security group admits
    # the load balancer's group on one port and nothing else, and there is no
    # ingress rule anywhere that references a CIDR.
    #
    # A profile with a private tier and NAT egress takes the first, and this
    # flips to false — the value tracks the network module's own answer rather
    # than being decided here.
    # ---------------------------------------------------------------
    assign_public_ip = var.workload_subnets_are_public
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = var.api_container_name
    container_port   = var.api_container_port
  }

  enable_ecs_managed_tags = true
  propagate_tags          = "SERVICE"

  # ECS Exec is off. Turning it on is one line here plus ssmmessages:CreateControlChannel,
  # CreateDataChannel, OpenControlChannel and OpenDataChannel on the *task* role
  # — which the services module owns, so it is not this module's to grant. A
  # service with enable_execute_command and no such policy fails to start tasks
  # with a message that names neither.
  enable_execute_command = false

  lifecycle {
    # desired_count is the value the service starts at, not the value it keeps.
    # Application Auto Scaling writes it on every scaling action, so leaving it
    # under Terraform's management means every plan after a scale-out proposes
    # scaling back in.
    ignore_changes = [desired_count]
  }

  # A service cannot register targets until the listener that fronts the target
  # group exists. Without this, first apply intermittently fails with "target
  # group does not have an associated load balancer".
  depends_on = [
    aws_lb_listener.http,
    aws_lb_listener.https,
  ]

  tags = {
    Name = var.names.ecs_service_api
    Tier = "compute"
  }
}
