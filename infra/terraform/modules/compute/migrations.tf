# ---------------------------------------------------------------------------
# Database migrations — a one-off task, run BEFORE the service is updated.
#
# WHY NOT IN THE ENTRYPOINT
#
# The obvious shortcut is `prisma migrate deploy && node dist/main.js` in the
# container command. It is wrong here for three separate reasons, any one of
# which is enough:
#
#   1. Concurrency. A rolling deploy starts the new task while the old one is
#      still serving, and an autoscaling event can start several at once. Each
#      would run migrations simultaneously against the same database. Prisma
#      takes an advisory lock, so the losers block rather than corrupt — but
#      they block for as long as the migration takes, inside a container the
#      load balancer is already health-checking, and the deploy fails on a
#      timeout that says nothing about migrations.
#   2. Failure attribution. A failed migration in the entrypoint looks exactly
#      like a failed application boot: the task exits, ECS retries it, the
#      circuit breaker rolls back, and the actual SQL error is one stream among
#      many in the application's log group.
#   3. The image. apps/api's runtime stage deliberately does not contain the
#      Prisma CLI (`pnpm deploy --prod --no-optional` drops it, along with 250 MB
#      of engines). Putting migrations in the entrypoint means putting the CLI
#      back into every running task, permanently, for something that runs once.
#
# So: Terraform defines the task definition, and the deploy workflow (PR 16)
# runs it as a discrete step and fails the deployment on a non-zero exit code
# before it touches the service. The contract is spelled out — command and all —
# in the migration_task_contract output.
# ---------------------------------------------------------------------------

locals {
  # Same repository as the API, different tag. See var.migrations_image_tag for
  # why it cannot be the same image.
  migrations_image = "${aws_ecr_repository.this["api"].repository_url}:${var.migrations_image_tag}"

  migrations_container = {
    name    = local.migrations_container_name
    image   = local.migrations_image
    command = var.migrations_command

    # Essential, so the task's exit code is this container's exit code. That
    # single number is the whole deployment gate: `describe-tasks` reports it,
    # and the workflow refuses to update the service unless it is 0.
    essential = true

    environment = [
      for name in sort(keys(var.migrations_environment)) : {
        name  = name
        value = var.migrations_environment[name]
      }
    ]

    # The same SSM-backed secrets the API gets, resolved by the same execution
    # role. DATABASE_URL is the one that matters; the rest cost nothing to carry
    # and mean the migration container boots with an environment identical to the
    # application's, so a migration that reads config does not behave differently.
    secrets = [
      for name in sort(keys(var.api_secrets)) : {
        name      = name
        valueFrom = var.api_secrets[name]
      }
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.migrations.name
        awslogs-region        = data.aws_region.current.region
        awslogs-stream-prefix = "ecs"
      }
    }

    linuxParameters = {
      initProcessEnabled = true
    }
  }

  migrations_container_name = "migrations"
}

resource "aws_ecs_task_definition" "migrations" {
  family                   = var.names.migrations_task
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"

  cpu    = var.migrations_cpu
  memory = var.migrations_memory

  execution_role_arn = var.task_execution_role_arn
  task_role_arn      = var.task_role_arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([local.migrations_container])

  tags = {
    Name = var.names.migrations_task
    Tier = "compute"
  }
}
