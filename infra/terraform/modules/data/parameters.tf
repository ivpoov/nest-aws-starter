# ---------------------------------------------------------------------------
# SSM Parameter Store
#
# Every secret the API boots with lives here, one parameter per environment
# variable, all SecureString. Two reasons for SSM rather than Secrets Manager:
#
#   cost      Standard-tier parameters are free. Secrets Manager is $0.40 per
#             secret per month plus API calls — call it $5/month for this stack,
#             for rotation nothing here uses.
#   shape     ECS resolves a task definition's `secrets` block by fetching one
#             parameter per environment variable. A single JSON blob (which is
#             what Secrets Manager encourages) has to be fetched and split by
#             the application instead, which means the application needs AWS
#             credentials before it can read its own configuration.
#
# One parameter per variable is also why the root stack carries no name for a
# single "/project/env/database" secret: that name describes the blob shape,
# and the parameters below are named after the variables the container actually
# receives.
#
# Encryption uses the AWS-managed alias/aws/ssm key. Free, and readable by any
# principal in the account that already holds ssm:GetParameters on the path, so
# it needs no extra kms:Decrypt statement. A customer-managed key would be
# stronger and would require adding kms:Decrypt on that key to both the task and
# execution roles, which the services module owns.
# ---------------------------------------------------------------------------

# The API's production boot guard refuses to start on a weak AUTH_JWT_SECRET.
# It does not check length: it scores `period x rate` — the shortest repeating
# block times ceil(log2(distinct characters)) — and demands 256 bits, precisely
# so that a long repetitive string cannot pass. The error message it prints
# recommends `openssl rand -hex 48`, so that is what this produces: 48 random
# bytes rendered as 96 hex characters, which the guard scores at 96 x 4 = 384
# bits. Comfortably clear, and clear on every draw rather than most of them —
# `openssl rand -base64 32` is only 44 characters and fails the same guard ~97%
# of the time.
#
# random_password would work too, but random_bytes says what it means: this is
# key material, not a password anyone types.
resource "random_bytes" "jwt_secret" {
  length = 48
}

locals {
  # Assembled from the instance's own attributes rather than typed out, so it
  # cannot drift from the database it points at. sslmode=require is what makes
  # rds.force_ssl in the parameter group a working setting instead of a
  # connection failure at first boot.
  database_url = format(
    "postgresql://%s:%s@%s:%d/%s?connection_limit=%d&sslmode=require",
    var.database_username,
    random_password.database.result,
    aws_db_instance.this.address,
    var.database_port,
    var.database_name,
    var.database_connection_limit,
  )

  # The one string that differs between the two shapes. `rediss://` is not a
  # typo: ioredis reads the extra s and negotiates TLS, which is what the
  # managed cache requires and what the loopback sidecar has no use for.
  cache_url = (
    var.managed_cache_enabled
    ? format("rediss://%s:%d", aws_elasticache_replication_group.this[0].primary_endpoint_address, var.cache_port)
    # 127.0.0.1, not "localhost": awsvpc gives the containers in a task one
    # network namespace, and Node resolving "localhost" to ::1 first on a stack
    # where the sidecar bound IPv4 is a slow, confusing first connection error.
    : format("redis://127.0.0.1:%d", var.cache_port)
  )

  # Written by Terraform because Terraform knows them.
  managed_parameters = {
    AUTH_JWT_SECRET = {
      value       = random_bytes.jwt_secret.hex
      description = "JWT signing secret. 48 random bytes as hex; regenerating it invalidates every issued access and refresh token."
    }
    DATABASE_URL = {
      value       = local.database_url
      description = "PostgreSQL connection string, assembled from the RDS instance's own endpoint and the generated master password."
    }
    REDIS_URL = {
      value       = local.cache_url
      description = "Redis connection string. Points at the managed cache, or at the task-local sidecar on 127.0.0.1."
    }
  }
}

resource "aws_ssm_parameter" "managed" {
  for_each = local.managed_parameters

  name        = "${var.parameter_prefix}/${each.key}"
  description = each.value.description
  type        = "SecureString"
  value       = each.value.value

  # Standard is free and holds 4 KB. Advanced is $0.05 per parameter per month
  # and buys 8 KB and policies, neither of which anything here needs.
  tier = "Standard"

  tags = {
    Name = "${var.parameter_prefix}/${each.key}"
    Tier = "data"
  }
}

# ---------------------------------------------------------------------------
# Placeholders
#
# Credentials that only come into existence when a human registers this
# application with somebody else — Google, Facebook, Discord, Stripe. Terraform
# cannot know them and must not pretend to.
#
# Creating them empty-shaped anyway is still worth it: the parameter path exists
# before the compute stack references it, so a task definition that injects
# GOOGLE_OAUTH_CLIENT_SECRET does not fail to start with an SSM ParameterNotFound
# on an account where nobody has got round to OAuth yet.
#
# ignore_changes on the value is the whole mechanism. Fill one in with
# `aws ssm put-parameter --overwrite` and Terraform leaves it alone forever
# after; without it, every apply would helpfully reset your live Stripe key back
# to REPLACE_ME. The reminder that they are still placeholders is an output
# (see outputs.tf), not a comment in a file nobody opens.
# ---------------------------------------------------------------------------

resource "aws_ssm_parameter" "placeholder" {
  for_each = var.placeholder_parameters

  name        = "${var.parameter_prefix}/${each.key}"
  description = each.value
  type        = "SecureString"
  value       = var.placeholder_value
  tier        = "Standard"

  lifecycle {
    ignore_changes = [value]
  }

  tags = {
    Name        = "${var.parameter_prefix}/${each.key}"
    Tier        = "data"
    Placeholder = "true"
  }
}
