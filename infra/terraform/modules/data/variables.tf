# Every input here is resolved by the caller from local.profile, local.names and
# the network module's outputs. This module deliberately knows nothing about cost
# profiles: it takes names, sizes, flags and subnet ids, and it never compares
# var.cost_profile (which it cannot even see). Adding a knob means adding a key
# to local.profile_settings in the root stack and threading it through as an
# input — never an `if` in here.

# ---------------------------------------------------------------------------
# Naming and placement
# ---------------------------------------------------------------------------

variable "names" {
  description = "Resource names, taken from local.names in the root stack. Nothing in this module is hand-named."
  type = object({
    database_identifier      = string
    database_subnet_group    = string
    database_parameter_group = string
    cache_cluster            = string
    cache_subnet_group       = string
  })
}

variable "subnet_ids" {
  description = "Subnets the database and the cache live in — the network module's workload_subnet_ids, which resolves to the private tier where it exists and the public one otherwise. Placement is the network module's decision, not this one's."
  type        = list(string)

  validation {
    # An RDS subnet group needs two AZs even for a single-AZ instance: AWS wants
    # somewhere to fail over to before it will accept the group at all.
    condition     = length(var.subnet_ids) >= 2
    error_message = "subnet_ids must contain at least two subnets — an RDS subnet group requires two availability zones even for a single-AZ instance."
  }
}

variable "database_security_group_id" {
  description = "Security group for the database, from the network module. It admits the API task group on the database port and nothing else."
  type        = string
}

variable "cache_security_group_id" {
  description = "Security group for the cache, from the network module. Ignored when no managed cache is created."
  type        = string
}

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

variable "database_engine_version" {
  description = "PostgreSQL engine version. A bare major (\"18\") lets AWS pick the current minor and keeps auto_minor_version_upgrade from showing as drift; pin a full \"18.4\" if you need byte-identical environments. Keep the major in step with the postgres image in docker-compose.yml."
  type        = string
  default     = "18"

  validation {
    condition     = can(regex("^[0-9]+(\\.[0-9]+)?$", var.database_engine_version))
    error_message = "database_engine_version must be a major version (\"18\") or a major.minor version (\"18.4\")."
  }
}

variable "database_instance_class" {
  description = "RDS instance class. db.t4g.micro is the cheapest Graviton class that runs this stack; t4g burst credits are ample for a demo and adequate for a small production API."
  type        = string
}

variable "database_allocated_storage_gb" {
  description = "Provisioned gp3 storage in GB. Twenty is the RDS floor for PostgreSQL. gp3 gives 3000 IOPS and 125 MB/s baseline at any size, so small does not mean slow here — unlike gp2, where IOPS scale with volume size."
  type        = number

  validation {
    condition     = var.database_allocated_storage_gb >= 20
    error_message = "database_allocated_storage_gb must be at least 20 — that is the RDS minimum for PostgreSQL."
  }
}

variable "database_max_allocated_storage_gb" {
  description = "Ceiling for RDS storage autoscaling, or 0 to leave the volume fixed. Autoscaling is billed only for storage it actually grows into, so a ceiling is cheap insurance against the one failure that takes a database fully offline: a full disk. Must be 0 or greater than database_allocated_storage_gb."
  type        = number
  default     = 0

  validation {
    condition = (
      var.database_max_allocated_storage_gb == 0 ||
      var.database_max_allocated_storage_gb > var.database_allocated_storage_gb
    )
    error_message = "database_max_allocated_storage_gb must be 0 (autoscaling off) or strictly greater than database_allocated_storage_gb."
  }
}

variable "database_multi_az" {
  description = "Run a synchronous standby in a second AZ. Roughly doubles the instance bill and is the difference between an AZ failure being a failover and being an outage."
  type        = bool
}

variable "database_backup_retention_days" {
  description = "Days of automated backups. Zero disables them entirely (and with them point-in-time recovery), which this module refuses. Backup storage up to the size of the database is free."
  type        = number

  validation {
    condition     = var.database_backup_retention_days >= 1 && var.database_backup_retention_days <= 35
    error_message = "database_backup_retention_days must be between 1 and 35. Zero would disable automated backups and point-in-time recovery altogether."
  }
}

variable "database_performance_insights_enabled" {
  description = "Enable Performance Insights. Free at the 7-day retention this module uses; longer retention is billed per vCPU."
  type        = bool
  default     = false
}

variable "database_deletion_protection" {
  description = "Refuse to delete the instance until this is turned off and applied. The whole point is that it makes `terraform destroy` fail loudly rather than silently taking the data with it."
  type        = bool
}

variable "database_skip_final_snapshot" {
  description = "Skip the snapshot RDS otherwise takes on delete. True is right for a stack meant to be thrown away; false is right for anything holding data you would miss."
  type        = bool
}

variable "database_name" {
  description = "Name of the database created inside the instance."
  type        = string
  default     = "starter"

  validation {
    condition     = can(regex("^[a-zA-Z][a-zA-Z0-9_]{0,62}$", var.database_name))
    error_message = "database_name must start with a letter and contain only letters, digits and underscores (PostgreSQL identifier rules)."
  }
}

variable "database_username" {
  description = "Master username. Not \"postgres\" by default: the account that owns the schema should not also be the name every credential-stuffing script tries first."
  type        = string
  default     = "appuser"

  validation {
    condition     = can(regex("^[a-z][a-z0-9_]{0,62}$", var.database_username)) && var.database_username != "rdsadmin"
    error_message = "database_username must be lowercase alphanumeric with underscores, start with a letter, and must not be \"rdsadmin\" (reserved by RDS)."
  }
}

variable "database_port" {
  description = "Port the database listens on. Must match the port the network module opened on the database security group."
  type        = number
  default     = 5432
}

variable "database_connection_limit" {
  description = "Prisma pool size written into DATABASE_URL. The arithmetic that matters is `tasks x connection_limit <= max_connections - reserved`; db.t4g.micro lands near 112 max_connections, db.t4g.small near 225. Revisit it whenever the task count changes."
  type        = number
  default     = 10

  validation {
    condition     = var.database_connection_limit >= 1
    error_message = "database_connection_limit must be at least 1."
  }
}

variable "database_backup_window" {
  description = "Daily UTC window for automated backups, hh:mm-hh:mm. Pinned rather than left to AWS so it cannot land on top of the maintenance window or your traffic peak."
  type        = string
  default     = "03:00-04:00"
}

variable "database_maintenance_window" {
  description = "Weekly UTC window for engine patching, ddd:hh:mm-ddd:hh:mm. Must not overlap the backup window."
  type        = string
  default     = "sun:04:30-sun:05:30"
}

variable "database_apply_immediately" {
  description = "Apply modifications at once instead of waiting for the maintenance window. Convenient while iterating; some changes reboot the instance, so it stays off by default."
  type        = bool
  default     = false
}

# ---------------------------------------------------------------------------
# Cache
# ---------------------------------------------------------------------------

variable "managed_cache_enabled" {
  description = <<-EOT
    Create an ElastiCache replication group.

    False means no ElastiCache resource exists at all, and the cache is expected
    to run as a second container inside the application task instead — see
    cache.tf and the module README for why, and for what the caller has to wire
    up on the task definition side.
  EOT
  type        = bool
}

variable "cache_node_type" {
  description = "ElastiCache node type. Ignored when managed_cache_enabled is false."
  type        = string
}

variable "cache_replica_count" {
  description = "Read replicas alongside the primary. Anything above zero also buys automatic failover and multi-AZ, which is the actual reason to pay for it. Ignored when managed_cache_enabled is false."
  type        = number
  default     = 0

  validation {
    condition     = var.cache_replica_count >= 0 && var.cache_replica_count <= 5
    error_message = "cache_replica_count must be between 0 and 5."
  }
}

variable "cache_engine_version" {
  description = "ElastiCache engine version. The parameter group family is derived from its major."
  type        = string
  default     = "7.1"

  validation {
    condition     = can(regex("^[0-9]+\\.[0-9]+$", var.cache_engine_version))
    error_message = "cache_engine_version must look like \"7.1\"."
  }
}

variable "cache_port" {
  description = "Port the cache listens on, managed or sidecar. Must match the port the network module opened on the cache security group."
  type        = number
  default     = 6379
}

variable "cache_snapshot_retention_days" {
  description = "Days of ElastiCache snapshots. Zero by default and deliberately: this cache holds sessions, rate-limit counters and a token allowlist, all of which are regenerated on demand. Snapshot storage is billed."
  type        = number
  default     = 0
}

variable "cache_maintenance_window" {
  description = "Weekly UTC window for ElastiCache patching, ddd:hh:mm-ddd:hh:mm."
  type        = string
  default     = "sun:05:30-sun:06:30"
}

variable "cache_sidecar_container_name" {
  description = "Name the compute stack should give the Redis sidecar container. Surfaced in the cache_sidecar output rather than assumed on both sides."
  type        = string
  default     = "cache"
}

variable "cache_sidecar_image" {
  description = "Image for the Redis sidecar. Pinned to a major tag on Alpine — a few megabytes, and the same major the local docker compose stack runs."
  type        = string
  default     = "redis:8-alpine"
}

variable "cache_sidecar_maxmemory" {
  description = "maxmemory the sidecar is started with. It shares the task's memory allocation with the API container, so it needs a ceiling and an eviction policy; without one the whole task is OOM-killed when the cache fills."
  type        = string
  default     = "128mb"
}

# ---------------------------------------------------------------------------
# Parameters
# ---------------------------------------------------------------------------

variable "parameter_prefix" {
  description = "SSM Parameter Store namespace for this stack's configuration, from local.secret_prefix. Leading slash, no trailing slash. The ECS task and execution roles are already scoped to everything under it."
  type        = string

  validation {
    condition     = startswith(var.parameter_prefix, "/") && !endswith(var.parameter_prefix, "/")
    error_message = "parameter_prefix must start with a slash and must not end with one, e.g. \"/myapp/dev\"."
  }
}

variable "placeholder_parameters" {
  description = <<-EOT
    Parameters Terraform creates but cannot fill in: third-party credentials that
    only exist once a human has registered the application somewhere. Keys are
    environment variable names, values are the description stored alongside the
    parameter — which is where an operator looks to find out where the real value
    comes from.

    Each is created once holding placeholder_value and then left alone forever
    (`ignore_changes`), so filling one in out of band is not reverted by the next
    apply. Terraform never invents a credential it cannot know.
  EOT
  type        = map(string)
  default     = {}
}

variable "placeholder_value" {
  description = "Sentinel written into every placeholder parameter. Chosen to be obviously wrong wherever it surfaces — in a log line, in an OAuth error, in a support ticket — rather than an empty string that reads as \"configured, but blank\"."
  type        = string
  default     = "REPLACE_ME"

  validation {
    condition     = length(var.placeholder_value) > 0
    error_message = "placeholder_value must not be empty — an empty parameter is indistinguishable from a configured one."
  }
}
