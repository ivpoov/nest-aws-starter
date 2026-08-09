# Nothing here exposes a credential. The master password and the JWT secret
# exist in state and in encrypted parameters, and that is the only place they
# exist — consumers get the ARN of a parameter, never the value inside it.

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

output "database_identifier" {
  description = "RDS instance identifier."
  value       = aws_db_instance.this.identifier
}

output "database_arn" {
  description = "ARN of the RDS instance. The observability stack alarms against it."
  value       = aws_db_instance.this.arn
}

output "database_address" {
  description = "Hostname of the instance, without the port."
  value       = aws_db_instance.this.address
}

output "database_endpoint" {
  description = "Hostname and port of the instance, as host:port."
  value       = aws_db_instance.this.endpoint
}

output "database_port" {
  description = "Port the instance listens on."
  value       = aws_db_instance.this.port
}

output "database_name" {
  description = "Name of the database inside the instance."
  value       = aws_db_instance.this.db_name
}

output "database_username" {
  description = "Master username. The password is not an output; read DATABASE_URL out of SSM if you need to connect by hand."
  value       = aws_db_instance.this.username
}

output "database_resource_id" {
  description = "Instance resource id (db-XXXX), which is what IAM database authentication policies are written against."
  value       = aws_db_instance.this.resource_id
}

output "database_subnet_group_name" {
  description = "Subnet group the instance was placed in."
  value       = aws_db_subnet_group.this.name
}

output "database_parameter_group_name" {
  description = "Parameter group applied to the instance."
  value       = aws_db_parameter_group.this.name
}

# ---------------------------------------------------------------------------
# Cache
# ---------------------------------------------------------------------------

output "managed_cache_enabled" {
  description = "True when an ElastiCache replication group exists. False means the compute stack is expected to run the Redis sidecar described by cache_sidecar."
  value       = var.managed_cache_enabled
}

output "cache_replication_group_id" {
  description = "ElastiCache replication group id, or null when the cache is a task sidecar."
  value       = one(aws_elasticache_replication_group.this[*].id)
}

output "cache_primary_endpoint" {
  description = "Writer endpoint of the replication group, or null when the cache is a task sidecar."
  value       = one(aws_elasticache_replication_group.this[*].primary_endpoint_address)
}

output "cache_reader_endpoint" {
  description = "Reader endpoint of the replication group, or null when the cache is a task sidecar or has no replicas."
  value       = one(aws_elasticache_replication_group.this[*].reader_endpoint_address)
}

output "cache_port" {
  description = "Port the cache listens on, managed or sidecar."
  value       = var.cache_port
}

output "cache_url" {
  description = "The REDIS_URL the application receives. Carries no credential: the managed cache is reached over TLS and restricted by security group, and the sidecar is on the loopback interface of its own task."
  value       = local.cache_url
}

output "cache_sidecar" {
  description = <<-EOT
    Everything the compute stack needs to add the Redis sidecar to the API task
    definition, or null when a managed cache exists and no sidecar is wanted.

    Consume it rather than hardcoding an image: when the cost profile changes,
    this becomes null and the container disappears from the task definition with
    no other edit.
  EOT
  value = var.managed_cache_enabled ? null : {
    name  = var.cache_sidecar_container_name
    image = var.cache_sidecar_image
    port  = var.cache_port

    # --save "" and --appendonly no: no persistence at all. Neither form of
    # durability means anything on a container with no volume, and RDB forks
    # would otherwise double the process's memory on a task sized in hundreds of
    # megabytes. The memory ceiling and eviction policy are what stop a filling
    # cache from OOM-killing the API container beside it.
    command = [
      "redis-server",
      "--save", "",
      "--appendonly", "no",
      "--maxmemory", var.cache_sidecar_maxmemory,
      "--maxmemory-policy", "allkeys-lru",
    ]

    # Essential: if the cache dies the API's sessions and rate limiting are gone
    # with it, so the honest response is to recycle the task rather than serve
    # from a half-working one.
    essential = true

    port_mappings = [{
      containerPort = var.cache_port
      protocol      = "tcp"
    }]
  }
}

# ---------------------------------------------------------------------------
# Parameters
# ---------------------------------------------------------------------------

output "parameter_prefix" {
  description = "Namespace every parameter above lives under."
  value       = var.parameter_prefix
}

output "container_secrets" {
  description = <<-EOT
    Every parameter this module created, as environment variable name -> SSM
    parameter ARN, placeholders included.

    Shaped for the compute stack to drop straight into a task definition:

      secrets = [
        for name, arn in module.data.container_secrets :
        { name = name, valueFrom = arn }
      ]

    ARNs, not values — ECS resolves them with the execution role at task start,
    so no secret is ever rendered into a task definition, a plan output or a
    console page.
  EOT
  value = merge(
    { for name, parameter in aws_ssm_parameter.managed : name => parameter.arn },
    { for name, parameter in aws_ssm_parameter.placeholder : name => parameter.arn },
  )
}

output "parameter_names" {
  description = "Environment variable name -> SSM parameter name, for reading or overwriting a value with the CLI."
  value = merge(
    { for name, parameter in aws_ssm_parameter.managed : name => parameter.name },
    { for name, parameter in aws_ssm_parameter.placeholder : name => parameter.name },
  )
}

output "placeholder_parameter_names" {
  description = "Only the parameters holding a placeholder. These are the ones a human still has to fill in."
  value       = sort([for parameter in aws_ssm_parameter.placeholder : parameter.name])
}

output "placeholders_notice" {
  description = "What Terraform could not know, and the exact command to supply it. Printed on every apply — placeholders that nobody is reminded about are how a stack ships with REPLACE_ME as a Stripe key."
  value = length(var.placeholder_parameters) == 0 ? "No placeholder parameters were requested." : join("\n", concat(
    [
      "ACTION REQUIRED — ${length(var.placeholder_parameters)} parameter(s) hold the placeholder \"${var.placeholder_value}\".",
      "",
      "Terraform created them so the task definition has something to reference, but it",
      "cannot invent third-party credentials. Until each one is filled in, the feature",
      "behind it is broken (OAuth) or disabled (Stripe). Supply them with:",
      "",
    ],
    [
      for name in sort(keys(var.placeholder_parameters)) :
      format(
        "  aws ssm put-parameter --overwrite --type SecureString \\\n    --name %s/%s \\\n    --value '<%s>'   # %s",
        var.parameter_prefix,
        name,
        name,
        var.placeholder_parameters[name],
      )
    ],
    [
      "",
      "Values set this way are never overwritten by a later apply — the parameters",
      "ignore changes to their value once created.",
    ],
  ))
}
