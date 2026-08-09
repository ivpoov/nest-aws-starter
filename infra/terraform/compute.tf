# ---------------------------------------------------------------------------
# Compute — ECR, the ECS cluster, the API service behind an ALB, the one-off
# migration task, and autoscaling.
#
# Everything the module needs is resolved here, from local.profile, local.names
# and the network, data, services and edge modules' outputs. The module itself
# never sees var.cost_profile.
#
# This is the file the deploy workflow reads: every id, name and URL a
# deployment needs is an output at the bottom, so nothing about a release is
# hand-copied. See modules/compute/README.md for the shape of the whole thing.
# ---------------------------------------------------------------------------

variable "api_image_tag" {
  description = <<-EOT
    Tag in the api ECR repository the service runs.

    "latest" is the bootstrap value, and it is the wrong one for a real
    deployment: it makes "what is running?" unanswerable and a rollback
    impossible. The deploy workflow passes the commit SHA instead, so every
    revision of the task definition names exactly one build.

    Terraform is not the thing that deploys code. Applying with a new tag here
    works, but the normal path is `aws ecs update-service` from the workflow —
    see the migration_task_contract output.
  EOT
  type        = string
  default     = "latest"
}

variable "migrations_image_tag" {
  description = "Tag in the api ECR repository holding the *migration* image — the Dockerfile's `build` target, which still has the Prisma CLI. The runtime image deliberately does not, so this cannot be the same tag as api_image_tag."
  type        = string
  default     = "migrations"
}

variable "api_extra_environment" {
  description = <<-EOT
    Extra non-secret environment for the API container, merged over the values
    this file derives. Use it for the application flags this stack has no opinion
    about (STRIPE_ENABLED, GOOGLE_OAUTH_ENABLED, NEW_DEVICE_EMAIL_ENABLED, …).

    Secrets do not go here. Anything set through this map is plaintext in the
    task definition and readable by anyone holding ecs:DescribeTaskDefinition;
    the data module owns the SSM-backed path for the rest.
  EOT
  type        = map(string)
  default     = {}
}

# ---------------------------------------------------------------------------
# Names
#
# Every one of them comes from local.names; this block only reshapes the flat
# map into the object the module's variable declares. Nothing here builds a
# string out of local.name_prefix.
#
# The migration log group deliberately sits under the same /aws/ecs/<prefix>
# path as the API's: that is the prefix the execution role's CreateLogStream
# statement is scoped to, and a group outside it fails to open a stream.
# ---------------------------------------------------------------------------

locals {
  compute_names = {
    ecs_cluster            = local.names.ecs_cluster
    task_definition_api    = local.names.task_definition_api
    ecs_service_api        = local.names.ecs_service_api
    alb                    = local.names.alb
    target_group_api       = local.names.target_group_api
    api_log_group          = local.names.api_log_group
    migrations_task        = local.names.migrations_task
    migrations_log_group   = local.names.migrations_log_group
    autoscaling_cpu_policy = local.names.autoscaling_cpu_policy
  }

  # One repository, not two. apps/web and apps/admin are static Vite builds
  # served from S3 through CloudFront (see edge.tf) — there is no web container
  # to store, and an empty repository that exists "in case" is a resource nobody
  # can explain later. local.names carries no ecr_web key for the same reason.
  # Adding one means adding it here and to the services module's
  # ecr_repository_names together, so the execution role can pull what it stores.
  compute_ecr_repositories = {
    api = local.names.ecr_api
  }

  # The API's hostname when there is a domain. Same derivation the edge module
  # uses — read from edge.tf's local rather than restated, so the two cannot
  # drift into serving CORS for a host the certificate does not cover.
  compute_api_hostname = length(local.edge_hostnames.api) > 0 ? local.edge_hostnames.api[0] : null
}

# ---------------------------------------------------------------------------
# Non-secret environment
#
# The split is the point: everything below is visible in the console and in
# `describe-task-definition`, and it is all fine to be. Every value that is not
# — DATABASE_URL, REDIS_URL, AUTH_JWT_SECRET, the OAuth and Stripe credentials —
# comes from module.data.container_secrets as an SSM ARN and is never rendered
# anywhere.
#
# REDIS_URL is not set here, at all, deliberately. The data module already ships
# it inside container_secrets pointing at whichever cache exists; a value here
# would silently override the module that knows the answer.
# ---------------------------------------------------------------------------

locals {
  compute_api_environment = merge(
    {
      NODE_ENV   = "production"
      PORT       = tostring(local.compute_api_container_port)
      API_PREFIX = "api"
      AWS_REGION = local.region

      # Behind an ALB the client's address is in X-Forwarded-For and the socket
      # address is the load balancer's. Without this every rate limit, audit log
      # entry and suspicious-login check attributes the whole internet to one IP.
      TRUST_PROXY = "true"

      S3_ENABLED     = "true"
      S3_BUCKET_NAME = module.services.uploads_bucket_name

      SQS_ENABLED                   = "true"
      SQS_PAYMENT_WEBHOOK_QUEUE_URL = module.services.payment_webhook_queue_url

      # The provider is constructed, and nothing in apps/api asks it to publish.
      # The task role holds no sns:Publish either — see modules/services/iam.tf
      # for why an unused grant is removed rather than scoped. Adding the first
      # publisher means adding that statement back, not flipping a flag here.
      SNS_ENABLED = "true"

      # Every origin a browser can legitimately load a frontend from, including
      # the *.cloudfront.net hostnames the edge module only knows after apply.
      # This is why the value is taken from the module rather than rebuilt from
      # var.domain_name: without a domain there is nothing else to compute it
      # from, and an API that rejects the CloudFront origin turns the demo into
      # an unexplained CORS failure.
      CORS_ORIGINS     = join(",", module.edge.cors_origins)
      WEB_APP_BASE_URL = module.edge.site_urls["web"]
    },

    local.compute_mail_environment,

    var.api_extra_environment,
  )

  # SES only exists when there is a domain to verify — see services.tf. With no
  # identity the task role holds no ses:SendEmail either, so announcing the
  # feature as enabled would produce a runtime denial instead of a cleanly
  # disabled transport.
  compute_mail_environment = local.mail_from_address == null ? {
    MAIL_ENABLED = "false"
    } : {
    MAIL_ENABLED      = "true"
    MAIL_FROM_ADDRESS = local.mail_from_address
  }

  # Must match the network module's api_container_port — the security group
  # rules between the ALB and the tasks are written against that number, and a
  # mismatch is a target group that never turns healthy.
  compute_api_container_port = 3000
}

# ---------------------------------------------------------------------------
# Module
# ---------------------------------------------------------------------------

module "compute" {
  source = "./modules/compute"

  names            = local.compute_names
  ecr_repositories = local.compute_ecr_repositories

  # Placement is the network module's decision. The ALB is public because it is
  # the front door; the tasks land wherever workload_subnet_ids resolves to, and
  # assign_public_ip follows from that rather than from the profile name.
  vpc_id                      = module.network.vpc_id
  public_subnet_ids           = module.network.public_subnet_ids
  workload_subnet_ids         = module.network.workload_subnet_ids
  workload_subnets_are_public = module.network.workload_subnets_are_public
  alb_security_group_id       = module.network.alb_security_group_id
  api_security_group_id       = module.network.api_security_group_id

  # Both roles come from the services module, which derived every statement in
  # them from a call site in apps/api. Nothing in the compute module creates IAM.
  task_role_arn           = module.services.task_role_arn
  task_execution_role_arn = module.services.task_execution_role_arn

  container_insights_enabled = local.profile.container_insights
  log_retention_days         = local.profile.log_retention_days
  use_fargate_spot           = local.profile.compute_use_fargate_spot

  task_cpu      = local.profile.compute_task_cpu
  task_memory   = local.profile.compute_task_memory
  desired_count = local.profile.compute_desired_count

  api_container_port = local.compute_api_container_port
  api_image_tag      = var.api_image_tag
  api_environment    = local.compute_api_environment

  # Straight through, ARNs only. ECS resolves each one with the execution role
  # at container start; no value is written into the task definition.
  api_secrets = module.data.container_secrets

  # Null whenever a managed cache exists, in which case no second container is
  # added at all. Nothing about the image or its command is restated here.
  cache_sidecar = module.data.cache_sidecar

  # /health/ready, not /health/live. The application mounts every route under
  # API_PREFIX with URI versioning on top, which is where the /api/v1 comes
  # from — the same construction apps/api/Dockerfile's HEALTHCHECK uses for the
  # liveness path.
  health_check_path = "/api/v1/health/ready"

  # HTTPS when there is a domain to put a certificate on, plain HTTP otherwise.
  # The check at the bottom of this file is what stops the second case from
  # being quiet.
  api_hostname   = local.compute_api_hostname
  hosted_zone_id = module.edge.hosted_zone_id

  autoscaling_enabled = local.profile.compute_autoscaling
  min_capacity        = local.profile.compute_min_capacity
  max_capacity        = local.profile.compute_max_capacity

  deletion_protection       = local.profile.deletion_protection
  force_delete_repositories = local.profile.force_destroy_bucket

  migrations_image_tag = var.migrations_image_tag

  # The migration container boots with the same non-secret environment as the
  # API so a migration that reads configuration sees what the application sees.
  migrations_environment = local.compute_api_environment
}

# ---------------------------------------------------------------------------
# Preflight warnings (soft — hard errors belong in variable validation)
# ---------------------------------------------------------------------------

check "api_served_over_plain_http" {
  assert {
    condition = var.domain_name != null
    error_message = join(" ", [
      "No domain_name is set, so the load balancer has no ACM certificate and serves the API over PLAIN HTTP on its *.elb.amazonaws.com hostname.",
      "Access tokens, refresh cookies, password payloads and webhook bodies cross the internet in the clear.",
      "This is a demo posture and nothing else: set domain_name, or enable the CloudFront distribution in front of the ALB (edge.tf) to get HTTPS without owning a domain.",
    ])
  }
}

check "single_task_ceiling" {
  assert {
    # Not a cost warning. Two pieces of apps/api are unreachable below two
    # tasks: the scheduler's Redis lock (which exists so N tasks produce one
    # execution) and the Socket.IO Redis adapter (which fans broadcasts across
    # tasks). A ceiling of one means neither is ever exercised before
    # production, and the first run of both is in front of users.
    condition = local.profile.compute_max_capacity > 1
    error_message = join(" ", [
      "The selected cost profile caps the API at one task, so the scheduler's Redis lock and the Socket.IO Redis adapter are never exercised — both are no-ops at a single task.",
      "Exercising them takes two edits in local.profile_settings, not one: raise compute_min_capacity and compute_max_capacity to 2, AND set managed_cache_enabled = true.",
      "The second is not optional and is not implied by the first — a Redis sidecar is per task, so two tasks would get two caches and disagree about who is logged in. The combination costs roughly $12/month for cache.t4g.micro plus about $3/month for a second Fargate Spot task.",
    ])
  }
}

check "autoscaling_has_room" {
  assert {
    condition = !local.profile.compute_autoscaling || local.profile.compute_max_capacity > local.profile.compute_min_capacity
    error_message = join(" ", [
      "The selected cost profile enables autoscaling but sets compute_min_capacity equal to compute_max_capacity, so the scaling policy and its two CloudWatch alarms exist and can never change anything.",
    ])
  }
}

check "tasks_without_egress" {
  assert {
    # A Fargate task pulls its image from ECR, opens a log stream and resolves
    # its SSM secrets over public AWS endpoints. In a private subnet that needs
    # NAT or interface endpoints; with neither, tasks fail to start with an
    # image-pull timeout that names none of this.
    condition = (
      module.network.workload_subnets_are_public ||
      length(module.network.nat_gateway_public_ips) > 0 ||
      length(var.interface_endpoints) > 0
    )
    error_message = join(" ", [
      "The selected cost profile puts ECS tasks in private subnets, but neither NAT egress nor interface VPC endpoints are configured — tasks cannot reach ECR, CloudWatch Logs or SSM and will fail to start with an image-pull timeout.",
      "Set enable_nat = true, or list at least [\"ecr.api\", \"ecr.dkr\", \"logs\", \"ssm\"] in interface_endpoints.",
    ])
  }
}

# ---------------------------------------------------------------------------
# Outputs
#
# Three audiences:
#   - edge.tf, which needs the load balancer's DNS name to put CloudFront in
#     front of the API (local.edge_alb_dns_name);
#   - the deploy workflow, which needs the registry, the cluster, the service
#     and the migration contract;
#   - the observability stack, which alarms on the ARN suffixes.
# ---------------------------------------------------------------------------

output "alb_dns_name" {
  description = "DNS name of the API load balancer. This is the value edge.tf's local.edge_alb_dns_name is waiting for: set it (and edge_api_distribution_enabled) to put CloudFront in front of the API."
  value       = module.compute.alb_dns_name
}

output "alb_zone_id" {
  description = "Route 53 zone id of the load balancer, for alias records pointed at it."
  value       = module.compute.alb_zone_id
}

output "alb_arn_suffix" {
  description = "Load balancer ARN suffix, in the form CloudWatch's AWS/ApplicationELB dimensions take."
  value       = module.compute.alb_arn_suffix
}

output "target_group_arn_suffix" {
  description = "API target group ARN suffix, for UnHealthyHostCount and TargetResponseTime alarms."
  value       = module.compute.target_group_arn_suffix
}

output "api_url" {
  description = "Where the API answers at the load balancer: https://api.<domain> with a domain, http://<alb-dns-name> without one. The frontends should use the edge URL when the API distribution is enabled; this is the direct one."
  value       = module.compute.api_url
}

output "api_https_enabled" {
  description = "True when the load balancer terminates TLS. False means the API is served in the clear and the deployment is test-only."
  value       = module.compute.https_enabled
}

output "api_certificate_arn" {
  description = "Regional ACM certificate on the load balancer, or null with no domain. Distinct from edge_certificate_arn, which is the us-east-1 one CloudFront requires."
  value       = module.compute.api_certificate_arn
}

output "ecr_repository_urls" {
  description = "Repository to push each image to, keyed by short name. `docker build` and `docker push` targets for the deploy workflow."
  value       = module.compute.ecr_repository_urls
}

output "ecs_cluster_name" {
  description = "ECS cluster — the --cluster argument of every deployment command."
  value       = module.compute.cluster_name
}

output "ecs_service_name" {
  description = "ECS service — the --service argument of `aws ecs update-service` and `aws ecs wait services-stable`."
  value       = module.compute.service_name
}

output "api_container_name" {
  description = "Name of the API container inside the task, needed verbatim by `aws ecs run-task --overrides`."
  value       = module.compute.api_container_name
}

output "api_task_definition_family" {
  description = "Family of the API task definition. A deployment registers a new revision in this family and points the service at it."
  value       = module.compute.api_task_definition_family
}

output "api_log_group_names" {
  description = "Log groups to tail when a deployment goes wrong, keyed by role."
  value       = module.compute.log_group_names
}

output "api_autoscaling" {
  description = "Effective scaling posture of the API service — whether it is on, and the floor and ceiling on the task count."
  value       = module.compute.autoscaling
}

output "migration_task_definition_family" {
  description = "Family of the one-off migration task definition. `aws ecs run-task --task-definition <family>` resolves the latest revision."
  value       = module.compute.migration_task_definition_family
}

output "migration_container_name" {
  description = "Name of the migration container. The deployment gate reads this container's exitCode out of `aws ecs describe-tasks`."
  value       = module.compute.migration_container_name
}

output "migration_network_configuration" {
  description = "Ready-to-use value for `aws ecs run-task --network-configuration`, JSON-encoded. Same placement and security group as the service."
  value       = module.compute.migration_network_configuration
}

output "deploy_contract" {
  description = "The ordered deployment the compute stack expects: build both images, run migrations as a one-off task, gate on its exit code, and only then update the service. Migrations are never run from the application entrypoint — the reasoning is in modules/compute/migrations.tf."
  value       = module.compute.migration_task_contract
}
