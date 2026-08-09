# Every input here is resolved by the caller from local.profile, local.names and
# the network, data and services modules' outputs. This module deliberately knows
# nothing about cost profiles: it takes names, sizes, flags, subnet ids and role
# ARNs, and it never compares var.cost_profile (which it cannot even see). Adding
# a knob means adding a key to local.profile_settings in the root stack and
# threading it through as an input — never an `if` in here.

# ---------------------------------------------------------------------------
# Naming
# ---------------------------------------------------------------------------

variable "names" {
  description = "Resource names, taken from local.names (and local.name_prefix, for the names local.names does not carry) in the root stack. Nothing in this module is hand-named."
  type = object({
    ecs_cluster            = string
    task_definition_api    = string
    ecs_service_api        = string
    alb                    = string
    target_group_api       = string
    api_log_group          = string
    migrations_task        = string
    migrations_log_group   = string
    autoscaling_cpu_policy = string
  })
}

variable "ecr_repositories" {
  description = "Repositories to create, as short key -> repository name. The key is what outputs are keyed by; the value is the ECR name (e.g. \"myapp-dev/api\"). The execution role in the services module is scoped to exactly these names, so a repository added here must be added there too."
  type        = map(string)

  validation {
    condition     = contains(keys(var.ecr_repositories), "api")
    error_message = "ecr_repositories must contain an \"api\" key — the API task definition pulls from it."
  }
}

# ---------------------------------------------------------------------------
# Placement
# ---------------------------------------------------------------------------

variable "vpc_id" {
  description = "VPC the load balancer's target group is registered in."
  type        = string
}

variable "public_subnet_ids" {
  description = "Public subnets the internet-facing load balancer spans. The ALB is always public — it is the front door — regardless of where the tasks land."
  type        = list(string)

  validation {
    condition     = length(var.public_subnet_ids) >= 2
    error_message = "public_subnet_ids must contain at least two subnets in different availability zones — an Application Load Balancer requires two."
  }
}

variable "workload_subnet_ids" {
  description = "Subnets the ECS tasks run in — the network module's workload_subnet_ids, which resolves to the private tier where it exists and the public one otherwise. Placement is the network module's decision, not this one's."
  type        = list(string)

  validation {
    condition     = length(var.workload_subnet_ids) > 0
    error_message = "workload_subnet_ids must not be empty — a Fargate task needs somewhere to get an ENI."
  }
}

variable "workload_subnets_are_public" {
  description = "True when the tasks land in public subnets. Drives assign_public_ip: a task in a public subnet has no route to ECR, CloudWatch or SSM without a public address, because the profile that skips the private tier is the profile that skips the NAT gateway too. Ingress is unaffected — the API security group admits the load balancer and nothing else."
  type        = bool
}

variable "alb_security_group_id" {
  description = "Security group for the load balancer, from the network module. The only group in the stack open to the internet."
  type        = string
}

variable "api_security_group_id" {
  description = "Security group for the API tasks, from the network module. Admits the ALB group on the container port; egresses to the data tier, DNS, NTP and 443."
  type        = string
}

# ---------------------------------------------------------------------------
# Identity — created by the services module, never here
# ---------------------------------------------------------------------------

variable "task_role_arn" {
  description = "ECS task role, from the services module: the identity the application's own AWS SDK calls run as."
  type        = string
}

variable "task_execution_role_arn" {
  description = "ECS task execution role, from the services module: image pull, log streams and SSM secret resolution. The application never assumes it."
  type        = string
}

# ---------------------------------------------------------------------------
# Cluster and capacity
# ---------------------------------------------------------------------------

variable "container_insights_enabled" {
  description = "Turn on Container Insights on the cluster. It is per-metric CloudWatch billing, which is why it is a profile decision rather than an always-on default."
  type        = bool
  default     = false
}

variable "log_retention_days" {
  description = "Retention on the log groups this module creates. Log groups are declared here rather than left to the awslogs driver precisely so that a retention policy exists — a driver-created group never expires and bills forever."
  type        = number
  default     = 7
}

variable "use_fargate_spot" {
  description = <<-EOT
    Run the service on FARGATE_SPOT rather than on-demand FARGATE.

    Spot is roughly 70% cheaper and can be reclaimed with a two-minute SIGTERM
    warning, which this application handles: it drains in-flight requests on
    SIGTERM and the service replaces the task. Correct for a disposable stack,
    wrong for one carrying a queue consumer you do not want interrupted.

    The one-off migration task never runs on Spot — see migrations.tf.
  EOT
  type        = bool
  default     = false
}

# ---------------------------------------------------------------------------
# Task sizing
# ---------------------------------------------------------------------------

variable "task_cpu" {
  description = "Fargate task CPU units (256 = 0.25 vCPU). Must be one of the valid Fargate CPU/memory pairs."
  type        = number
  default     = 256
}

variable "task_memory" {
  description = "Fargate task memory in MiB. Must pair with task_cpu per the Fargate size table."
  type        = number
  default     = 512

  validation {
    # The pairing rule AWS enforces at RegisterTaskDefinition time, restated
    # here so it fails at plan rather than 20 resources into an apply.
    condition = (
      (var.task_cpu == 256 && contains([512, 1024, 2048], var.task_memory)) ||
      (var.task_cpu == 512 && var.task_memory >= 1024 && var.task_memory <= 4096 && var.task_memory % 1024 == 0) ||
      (var.task_cpu == 1024 && var.task_memory >= 2048 && var.task_memory <= 8192 && var.task_memory % 1024 == 0) ||
      (var.task_cpu == 2048 && var.task_memory >= 4096 && var.task_memory <= 16384 && var.task_memory % 1024 == 0) ||
      (var.task_cpu == 4096 && var.task_memory >= 8192 && var.task_memory <= 30720 && var.task_memory % 1024 == 0)
    )
    error_message = "task_cpu and task_memory are not a valid Fargate pair. 256 allows 512/1024/2048 MiB; 512 allows 1-4 GiB; 1024 allows 2-8 GiB; 2048 allows 4-16 GiB; 4096 allows 8-30 GiB, all in 1 GiB steps."
  }
}

variable "desired_count" {
  description = "Tasks the service starts with. Once autoscaling is attached this is the initial value only — the scaling target owns desired_count from then on, and the service ignores changes to it."
  type        = number
  default     = 1
}

# ---------------------------------------------------------------------------
# The API container
# ---------------------------------------------------------------------------

variable "api_container_name" {
  description = "Name of the API container inside the task. The deploy workflow passes it to `aws ecs run-task --overrides` and the ALB target references it, so it is an output as well as an input."
  type        = string
  default     = "api"
}

variable "api_container_port" {
  description = "Port the API listens on. Must match the network module's api_container_port — the security group rules are written against that one."
  type        = number
  default     = 3000
}

variable "api_image_tag" {
  description = "Tag in the api repository the service runs. \"latest\" is the bootstrap value; a real deployment sets the commit SHA, so that what is running is identifiable and a rollback is a tag away."
  type        = string
  default     = "latest"
}

variable "api_environment" {
  description = "Non-secret environment for the API container, as name -> value. Anything that must not appear in `describe-task-definition` belongs in api_secrets instead."
  type        = map(string)
  default     = {}
}

variable "api_secrets" {
  description = "Secret environment for the API container, as environment variable name -> SSM parameter ARN (the data module's container_secrets, unchanged). Rendered into the task definition's `secrets` block, so ECS resolves each ARN with the execution role at task start and no value is ever written into the task definition, a plan, or a console page."
  type        = map(string)
  default     = {}
}

variable "stop_timeout_seconds" {
  description = "Grace between SIGTERM and SIGKILL for the containers in the task. The API exits cleanly in well under a second when idle; this window is sized for the slowest in-flight request worth waiting for. Fargate caps it at 120."
  type        = number
  default     = 30

  validation {
    condition     = var.stop_timeout_seconds > 0 && var.stop_timeout_seconds <= 120
    error_message = "stop_timeout_seconds must be between 1 and 120 — Fargate refuses anything above 120."
  }
}

# ---------------------------------------------------------------------------
# The cache sidecar
# ---------------------------------------------------------------------------

variable "cache_sidecar" {
  description = <<-EOT
    The data module's cache_sidecar output, passed through untouched: a container
    spec when Redis runs beside the API, or null when a managed cache exists.

    Null is the normal case for any stack that can run more than one task, and
    the container simply disappears from the task definition — no image, port or
    command is written down here.
  EOT
  type = object({
    name      = string
    image     = string
    port      = number
    command   = list(string)
    essential = bool
    port_mappings = list(object({
      containerPort = number
      protocol      = string
    }))
  })
  default = null
}

# ---------------------------------------------------------------------------
# Load balancer
# ---------------------------------------------------------------------------

variable "health_check_path" {
  description = "Path the target group polls. This is the readiness probe, not the liveness one: the load balancer's question is \"can this task serve a request end to end?\", which includes Postgres and Redis. /health/live answers a different question and belongs to the container health check."
  type        = string
  default     = "/api/v1/health/ready"
}

variable "health_check_grace_period_seconds" {
  description = "How long after a task reaches RUNNING the service ignores load balancer health checks. Sized to real boot time — Nest bootstrap plus the first Prisma connection — not to image pull, which happens before RUNNING."
  type        = number
  default     = 60
}

variable "deregistration_delay_seconds" {
  description = "How long the target group keeps draining a target after deregistering it, before the task is stopped. See alb.tf for the number's derivation."
  type        = number
  default     = 60

  validation {
    condition     = var.deregistration_delay_seconds >= 0 && var.deregistration_delay_seconds <= 3600
    error_message = "deregistration_delay_seconds must be between 0 and 3600."
  }
}

variable "alb_idle_timeout_seconds" {
  description = "Idle timeout on the load balancer. Must exceed the WebSocket heartbeat interval the application uses, or the ALB closes live sockets between heartbeats."
  type        = number
  default     = 300
}

variable "session_stickiness_enabled" {
  description = "Bind a client to one target with the ALB's own cookie. Required by Socket.IO's default transport ladder — see alb.tf."
  type        = bool
  default     = true
}

variable "session_stickiness_duration_seconds" {
  description = "Lifetime of the ALB stickiness cookie."
  type        = number
  default     = 86400
}

variable "access_logs" {
  description = <<-EOT
    Where the load balancer delivers its access logs, resolved by the caller.

    The bucket is not created here — it is the shared access-log bucket the
    observability module owns, and the bucket policy that permits delivery lives
    with it. `bucket` is null whenever `enabled` is false, which is why alb.tf
    writes the block dynamically rather than passing `enabled = false`.
  EOT

  type = object({
    enabled = bool
    bucket  = string
    prefix  = string
  })

  default = {
    enabled = false
    bucket  = null
    prefix  = null
  }

  validation {
    # A load balancer created with logging on and no bucket is not a warning
    # case: ELB rejects it at create time, halfway through an apply.
    condition     = !var.access_logs.enabled || try(length(var.access_logs.bucket) > 0, false)
    error_message = "access_logs.enabled is true but access_logs.bucket is null or empty — the load balancer has nowhere to deliver to and ELB refuses to create it."
  }
}

variable "deletion_protection" {
  description = "Refuse to delete the load balancer. Comes from the profile's deletion_protection, so a disposable stack stays disposable."
  type        = bool
  default     = false
}

variable "force_delete_repositories" {
  description = "Let `terraform destroy` delete ECR repositories that still contain images. Comes from the profile's force_destroy_bucket, for the same reason: a demo stack that cannot be torn down is not disposable."
  type        = bool
  default     = false
}

# ---------------------------------------------------------------------------
# Custom domain (optional)
# ---------------------------------------------------------------------------

variable "api_hostname" {
  description = "Hostname to serve the API on, e.g. api.example.com. Null means no ACM certificate and no HTTPS listener — see the warning in alb.tf."
  type        = string
  default     = null
}

variable "hosted_zone_id" {
  description = "Route 53 zone to publish the certificate validation record and the API alias record into, from the edge module. Null disables the custom-domain path even when api_hostname is set: DNS validation cannot complete without a zone to write to."
  type        = string
  default     = null
}

# ---------------------------------------------------------------------------
# Autoscaling
# ---------------------------------------------------------------------------

variable "autoscaling_enabled" {
  description = "Attach a scaling target and a CPU target-tracking policy to the service."
  type        = bool
  default     = false
}

variable "min_capacity" {
  description = "Floor on the task count."
  type        = number
  default     = 1
}

variable "max_capacity" {
  description = "Ceiling on the task count. Also the value the data module reads to decide whether Redis can be a task-local sidecar — a ceiling above one means a shared cache is required."
  type        = number
  default     = 1

  validation {
    condition     = var.max_capacity >= var.min_capacity
    error_message = "max_capacity must be greater than or equal to min_capacity."
  }
}

variable "autoscaling_target_cpu_percent" {
  description = "Average CPU utilisation the target-tracking policy holds the service at. Below ~40 the service scales out on noise; above ~80 there is no headroom left to absorb the load while the new task boots."
  type        = number
  default     = 60

  validation {
    condition     = var.autoscaling_target_cpu_percent > 0 && var.autoscaling_target_cpu_percent < 100
    error_message = "autoscaling_target_cpu_percent must be between 1 and 99."
  }
}

variable "autoscaling_scale_out_cooldown_seconds" {
  description = "Quiet period after scaling out. Roughly one task's time to boot and pass health checks, so the policy does not order a second task while the first is still starting."
  type        = number
  default     = 60
}

variable "autoscaling_scale_in_cooldown_seconds" {
  description = "Quiet period after scaling in. Deliberately several times the scale-out cooldown: scaling out early is cheap, scaling in early drops capacity that is about to be needed again."
  type        = number
  default     = 300
}

# ---------------------------------------------------------------------------
# ECR lifecycle
# ---------------------------------------------------------------------------

variable "image_retention_count" {
  description = "Tagged images to keep per repository. Older ones expire — a repository that keeps every image ever built bills storage forever."
  type        = number
  default     = 10

  validation {
    condition     = var.image_retention_count >= 2
    error_message = "image_retention_count must be at least 2 — keeping only the current image leaves nothing to roll back to."
  }
}

variable "untagged_image_expiry_days" {
  description = "Days an untagged image survives. Untagged layers are what a re-pushed tag leaves behind, and nothing ever deletes them by itself; the delay exists so an image mid-push is not expired out from under the build."
  type        = number
  default     = 1
}

# ---------------------------------------------------------------------------
# Migrations
# ---------------------------------------------------------------------------

variable "migrations_image_tag" {
  description = <<-EOT
    Tag in the api repository the migration task runs.

    NOT the same image as the service, on purpose. The runtime stage of
    apps/api/Dockerfile deliberately drops the Prisma CLI (`pnpm deploy --prod
    --no-optional`), so `prisma migrate deploy` cannot run in it. The deploy
    workflow builds the Dockerfile's `build` stage — which has the CLI, the
    workspace and prisma/migrations — and pushes it under this tag beside the
    runtime image.

    This tag MOVES: the task definition below names it, and a deployment does
    not re-register that definition, so each deploy repoints it. The same image
    is also pushed as `<tag>-<commit-sha>`, which does not move — that is the
    name to use when you need to know which image applied a given schema, or to
    retag one by hand. Only this moving tag belongs here.
  EOT
  type        = string
  default     = "migrations"
}

variable "migrations_command" {
  description = "Command the migration container runs. Must be idempotent and safe to re-run: the deploy workflow reruns it on every deployment, and `prisma migrate deploy` applies only the migrations that are missing."
  type        = list(string)
  default     = ["pnpm", "--filter", "@nest-aws-starter/api", "run", "db:migrate"]
}

variable "migrations_cpu" {
  description = "Fargate CPU units for the one-off migration task. Migrations are IO-bound against RDS; the size only affects how fast the container starts."
  type        = number
  default     = 256
}

variable "migrations_memory" {
  description = "Fargate memory in MiB for the one-off migration task. The build-stage image carries the full workspace, so it is given more headroom than the runtime task."
  type        = number
  default     = 1024
}

variable "migrations_environment" {
  description = "Non-secret environment for the migration container. Secrets come from api_secrets — DATABASE_URL among them, which is the only one migrations actually need."
  type        = map(string)
  default     = {}
}
