# ---------------------------------------------------------------------------
# Data: PostgreSQL, Redis, and every secret the API boots with.
#
# Everything the module needs is resolved here, from local.profile, local.names
# and the network module's outputs. The module itself never sees
# var.cost_profile.
#
# The file is called datastores.tf rather than data.tf because data.tf already
# exists and holds the stack's `data` sources — sharing a file with them would
# put this module's wiring in a file every other stack also edits.
# ---------------------------------------------------------------------------

variable "database_name" {
  description = "Name of the database created inside the RDS instance. Matches the local docker compose database so a dump moves between them without renaming anything."
  type        = string
  default     = "starter"
}

variable "database_username" {
  description = "RDS master username. Not \"postgres\": the account that owns the schema should not also be the first name every credential-stuffing script tries."
  type        = string
  default     = "appuser"
}

variable "database_engine_version" {
  description = "PostgreSQL major version, or major.minor to pin exactly. Keep the major in step with the postgres image in docker-compose.yml — a starter whose local and deployed databases are different majors will eventually produce a migration that works in one and not the other. Check availability in your region with `aws rds describe-db-engine-versions --engine postgres`."
  type        = string
  default     = "18"
}

variable "database_connection_limit" {
  description = "Prisma pool size per task, written into DATABASE_URL. The constraint is `max task count x connection_limit <= max_connections - reserved`; db.t4g.micro lands near 112 max_connections. See the check at the bottom of this file."
  type        = number
  default     = 10
}

variable "database_max_allocated_storage_gb" {
  description = "Ceiling for RDS storage autoscaling, or 0 to leave the volume at its allocated size. Autoscaling bills only for storage it actually grows into, so a ceiling is cheap insurance against a full disk — which is the one database failure that has no partial mode."
  type        = number
  default     = 0
}

locals {
  # Whether the cache is a managed service or a container beside the API is not
  # a cost-profile question, it is a correctness one: a task-local cache is
  # correct exactly while there is one task. Two tasks with two sidecars would
  # disagree about who is logged in, because the refresh-token allowlist lives
  # in Redis.
  #
  # So this keys off the ceiling on the task count rather than off the profile
  # name. compute_max_capacity, not compute_desired_count: with autoscaling on,
  # desired is where the service starts and max is how many tasks can exist.
  #
  # There is no `managed_cache_enabled` key in local.profile_settings today and
  # this file does not own locals.tf. If that key is ever added, point this at
  # it — and keep the rule above in its comment.
  datastores_managed_cache_enabled = local.profile.compute_max_capacity > 1

  # Credentials that come into existence only when a human registers this
  # application somewhere. Terraform creates the parameter and describes where
  # the value comes from; it never invents the value. The keys are the
  # environment variable names apps/api reads — see apps/api/.env.example.
  datastores_placeholder_parameters = {
    GOOGLE_OAUTH_CLIENT_ID       = "Google OAuth client id — Google Cloud Console, APIs & Services, Credentials. Also set GOOGLE_OAUTH_ENABLED=true."
    GOOGLE_OAUTH_CLIENT_SECRET   = "Google OAuth client secret, issued beside the client id."
    FACEBOOK_OAUTH_CLIENT_ID     = "Facebook app id — Meta for Developers, App settings, Basic. Also set FACEBOOK_OAUTH_ENABLED=true."
    FACEBOOK_OAUTH_CLIENT_SECRET = "Facebook app secret, on the same page as the app id."
    DISCORD_OAUTH_CLIENT_ID      = "Discord application id — Discord Developer Portal, OAuth2. Also set DISCORD_OAUTH_ENABLED=true."
    DISCORD_OAUTH_CLIENT_SECRET  = "Discord client secret, on the same page as the application id."
    STRIPE_SECRET_KEY            = "Stripe secret key (sk_live_... in production, sk_test_... while testing) — Stripe Dashboard, Developers, API keys. Also set STRIPE_ENABLED=true."
    STRIPE_WEBHOOK_SECRET        = "Stripe webhook signing secret (whsec_...), issued per endpoint when you add the webhook in the Stripe Dashboard. It is not the API key."
  }
}

module "data" {
  source = "./modules/data"

  names = {
    database_identifier      = local.names.database_identifier
    database_subnet_group    = local.names.database_subnet_group
    database_parameter_group = local.names.database_parameter_group
    cache_cluster            = local.names.cache_cluster
    cache_subnet_group       = local.names.cache_subnet_group
  }

  # Placement is the network module's decision. workload_subnet_ids resolves to
  # the private tier where it exists and the public one otherwise, so nothing
  # here has to know which profile is in play — and the database is unreachable
  # from outside either way, because publicly_accessible is false and the
  # security group admits only the API tasks.
  subnet_ids                 = module.network.workload_subnet_ids
  database_security_group_id = module.network.database_security_group_id
  cache_security_group_id    = module.network.cache_security_group_id

  database_engine_version               = var.database_engine_version
  database_instance_class               = local.profile.database_instance_class
  database_allocated_storage_gb         = local.profile.database_allocated_storage_gb
  database_max_allocated_storage_gb     = var.database_max_allocated_storage_gb
  database_multi_az                     = local.profile.database_multi_az
  database_backup_retention_days        = local.profile.database_backup_retention_days
  database_performance_insights_enabled = local.profile.database_performance_insights

  # The pair that decides whether a stack can be thrown away. Demo: destroyable,
  # no final snapshot to clean up afterwards. Production: `terraform destroy`
  # fails on the instance, and deleting it deliberately still leaves a snapshot.
  database_deletion_protection = local.profile.deletion_protection
  database_skip_final_snapshot = local.profile.skip_final_snapshot

  database_name             = var.database_name
  database_username         = var.database_username
  database_connection_limit = var.database_connection_limit

  managed_cache_enabled = local.datastores_managed_cache_enabled
  cache_node_type       = local.profile.cache_node_type
  cache_replica_count   = local.profile.cache_replica_count

  parameter_prefix       = local.secret_prefix
  placeholder_parameters = local.datastores_placeholder_parameters
}

# ---------------------------------------------------------------------------
# Preflight warnings (soft — hard errors belong in variable validation)
# ---------------------------------------------------------------------------

check "database_connection_pool" {
  assert {
    # db.t4g.micro (1 GiB) computes max_connections at roughly 112, and
    # PostgreSQL reserves three of those for superusers. 90 leaves room for a
    # migration job, a psql session and a deploy running old and new tasks side
    # by side. Exhausting the pool does not degrade: new connections are refused
    # and the API returns 500s until something restarts.
    condition     = local.profile.compute_max_capacity * var.database_connection_limit <= 90
    error_message = "max task count x database_connection_limit exceeds 90 connections, which is more than a db.t4g.micro can serve (~112 max_connections, three reserved for superusers). Lower database_connection_limit, cap the task count, or move to a larger instance class."
  }
}

check "ephemeral_cache_in_a_durable_stack" {
  assert {
    # Deletion protection says "this stack holds something worth keeping". A
    # sidecar cache says "every deploy logs everyone out". Both at once is
    # almost always an accident.
    condition     = local.datastores_managed_cache_enabled || !local.profile.deletion_protection
    error_message = "The selected cost profile protects the database from deletion but caps the task count at one, so Redis runs as a task-local sidecar. That cache is emptied by every deploy, task replacement and crash — which signs every user out, because the refresh-token allowlist lives in it. Raise compute_max_capacity above one to get a shared ElastiCache replication group."
  }
}

# ---------------------------------------------------------------------------
# Outputs consumed by the compute, edge and observability stacks
# ---------------------------------------------------------------------------

output "database_endpoint" {
  description = "Database hostname and port, as host:port. The password is not an output — read DATABASE_URL out of SSM."
  value       = module.data.database_endpoint
}

output "database_address" {
  description = "Database hostname, without the port."
  value       = module.data.database_address
}

output "database_port" {
  description = "Port the database listens on."
  value       = module.data.database_port
}

output "database_name" {
  description = "Name of the database inside the instance."
  value       = module.data.database_name
}

output "database_username" {
  description = "Database master username."
  value       = module.data.database_username
}

output "database_identifier" {
  description = "RDS instance identifier."
  value       = module.data.database_identifier
}

output "database_arn" {
  description = "ARN of the RDS instance, for alarms in the observability stack."
  value       = module.data.database_arn
}

output "managed_cache_enabled" {
  description = "True when an ElastiCache replication group exists. False means the compute stack must run the Redis sidecar described by cache_sidecar."
  value       = module.data.managed_cache_enabled
}

output "cache_primary_endpoint" {
  description = "ElastiCache writer endpoint, or null when the cache is a task sidecar."
  value       = module.data.cache_primary_endpoint
}

output "cache_port" {
  description = "Port the cache listens on, managed or sidecar."
  value       = module.data.cache_port
}

output "cache_url" {
  description = "The REDIS_URL the application receives — rediss:// to the managed cache, redis://127.0.0.1 to the sidecar. The application code is identical either way."
  value       = module.data.cache_url
}

output "cache_sidecar" {
  description = "Container definition inputs for the Redis sidecar the compute stack must add to the API task, or null when a managed cache exists. Consume it rather than hardcoding the image: when it becomes null, the container disappears with no other edit."
  value       = module.data.cache_sidecar
}

output "container_secrets" {
  description = "Environment variable name -> SSM parameter ARN for every secret the API boots with. Drop straight into an ECS task definition's `secrets` block; ECS resolves the ARNs with the execution role, so no value is rendered into the task definition."
  value       = module.data.container_secrets
}

output "parameter_names" {
  description = "Environment variable name -> SSM parameter name, for reading or overwriting a value with the CLI."
  value       = module.data.parameter_names
}

output "placeholder_parameter_names" {
  description = "Parameters still holding the placeholder sentinel. These are the credentials a human has to supply."
  value       = module.data.placeholder_parameter_names
}

output "secrets_action_required" {
  description = "What Terraform could not know, and the exact commands to supply it. Read this after the first apply."
  value       = module.data.placeholders_notice
}
