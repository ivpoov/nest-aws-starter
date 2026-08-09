# ---------------------------------------------------------------------------
# API task definition
#
# One or two containers in one task:
#
#   api     the application. Pulls from this stack's ECR repository.
#   redis   the cache sidecar, present only while var.cache_sidecar is non-null
#           — i.e. only while the task ceiling is one. Its whole specification
#           comes from the data module; nothing about it is written down here.
#
# awsvpc gives every container in the task one network namespace, which is why
# the API reaches the sidecar on 127.0.0.1 and why nothing has to be published.
# ---------------------------------------------------------------------------

locals {
  api_image = "${aws_ecr_repository.this["api"].repository_url}:${var.api_image_tag}"

  cache_sidecar_enabled = var.cache_sidecar != null

  # Shared by both containers. Written out once so the sidecar's logs land in
  # the same group with a different stream prefix, instead of nowhere.
  api_log_configuration = {
    logDriver = "awslogs"
    options = {
      awslogs-group         = aws_cloudwatch_log_group.api.name
      awslogs-region        = data.aws_region.current.region
      awslogs-stream-prefix = "ecs"
    }
  }

  # ---------------------------------------------------------------------
  # Secrets, not environment.
  #
  # `environment` is plaintext in the task definition: anyone with
  # ecs:DescribeTaskDefinition can read it, it is rendered on the console's task
  # page, and it is in every `terraform plan` diff. `secrets` stores an SSM ARN
  # instead — ECS resolves it with the *execution* role at container start and
  # injects the value into the process environment, so the value exists in the
  # container and nowhere else.
  #
  # REDIS_URL is deliberately absent from this file: the data module owns it and
  # ships it inside var.api_secrets already, pointing at either the managed cache
  # or 127.0.0.1 depending on which cache exists. Setting it here would silently
  # win against the module that actually knows the answer.
  # ---------------------------------------------------------------------
  api_secrets = [
    for name in sort(keys(var.api_secrets)) : {
      name      = name
      valueFrom = var.api_secrets[name]
    }
  ]

  api_environment = [
    for name in sort(keys(var.api_environment)) : {
      name  = name
      value = var.api_environment[name]
    }
  ]

  cache_sidecar_container = local.cache_sidecar_enabled ? [{
    name      = var.cache_sidecar.name
    image     = var.cache_sidecar.image
    essential = var.cache_sidecar.essential
    command   = var.cache_sidecar.command

    portMappings = [
      for mapping in var.cache_sidecar.port_mappings : {
        containerPort = mapping.containerPort
        protocol      = mapping.protocol
      }
    ]

    logConfiguration = merge(local.api_log_configuration, {
      options = merge(local.api_log_configuration.options, {
        awslogs-stream-prefix = var.cache_sidecar.name
      })
    })

    stopTimeout = var.stop_timeout_seconds
  }] : []

  # ---------------------------------------------------------------------
  # Start after the cache, when there is one.
  #
  # Without this the two containers start together and the API's first Redis
  # connection races redis-server's bind. ioredis retries, so the task
  # eventually converges — but the first boot logs an ECONNREFUSED, the
  # readiness probe reports degraded for a few seconds, and on a deploy that is
  # long enough for the target group to count an unhealthy check against a task
  # that is in fact fine.
  #
  # START, not HEALTHY: HEALTHY would need a healthCheck on the sidecar
  # (redis-cli ping), and the sidecar's spec is the data module's to define, not
  # this file's. START removes the race at no cost.
  #
  # Merged in rather than set to null when absent — a literal "dependsOn": null
  # in the JSON is not the same thing to ECS as the key being missing.
  api_container_depends_on = local.cache_sidecar_enabled ? {
    dependsOn = [{
      containerName = var.cache_sidecar.name
      condition     = "START"
    }]
  } : {}

  api_container = merge(local.api_container_depends_on, {
    name      = var.api_container_name
    image     = local.api_image
    essential = true

    portMappings = [{
      containerPort = var.api_container_port
      protocol      = "tcp"
      name          = var.api_container_name
      appProtocol   = "http"
    }]

    environment = local.api_environment
    secrets     = local.api_secrets

    logConfiguration = local.api_log_configuration

    # Node as PID 1 handles its own signals correctly but does not reap orphans.
    # The init process does — see the deployment notes in docs/guides/container.md.
    linuxParameters = {
      initProcessEnabled = true
    }

    # Sized for in-flight requests, not for process exit: the application's clean
    # SIGTERM shutdown was measured at ~97 ms idle. See the deregistration delay
    # note in alb.tf for how the two windows compose.
    stopTimeout = var.stop_timeout_seconds
  })
}

resource "aws_ecs_task_definition" "api" {
  family                   = var.names.task_definition_api
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"

  cpu    = var.task_cpu
  memory = var.task_memory

  execution_role_arn = var.task_execution_role_arn
  task_role_arn      = var.task_role_arn

  runtime_platform {
    operating_system_family = "LINUX"

    # X86_64 because apps/api/Dockerfile pins its base image by digest, and that
    # digest is an amd64 manifest. ARM64 Fargate is ~20% cheaper and would be the
    # better default — it needs a multi-arch build in the image pipeline first,
    # so changing this alone would produce a task that cannot start.
    cpu_architecture = "X86_64"
  }

  # Sidecar first: container_definitions is an unordered set to ECS, but keeping
  # the dependency's definition ahead of its dependent's makes the JSON readable.
  container_definitions = jsonencode(concat(local.cache_sidecar_container, [local.api_container]))

  tags = {
    Name = var.names.task_definition_api
    Tier = "compute"
  }
}
