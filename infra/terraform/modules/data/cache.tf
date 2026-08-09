# ---------------------------------------------------------------------------
# Redis
#
# Two shapes, one application.
#
#   managed_cache_enabled = false  no ElastiCache resource is created at all.
#                                  Redis runs as a second container in the same
#                                  ECS task, reachable on 127.0.0.1, and costs
#                                  nothing beyond the task that was already
#                                  running.
#
#   managed_cache_enabled = true   an ElastiCache replication group, shared by
#                                  every task, encrypted in transit.
#
# Why not ElastiCache everywhere: because a serverless-shaped cache carries a
# monthly floor that dwarfs the rest of a small stack. ElastiCache Serverless
# bills a minimum of 1 GB of stored data at roughly $0.084/GB-hour, about
# $61/month before a single ECPU is charged — on a demo stack whose ECS task,
# database and load balancer together cost less than that. A node-based
# cache.t4g.micro is around $12/month, which is better but is still $12/month of
# nothing on a stack whose entire cache is disposable. So the disposable stack
# does not get one.
#
# Why not skip Redis in demo instead: because then the demo stops exercising the
# code the production stack runs. Sessions, the refresh-token allowlist, the
# rate limiter and the Socket.IO adapter all talk to Redis; swapping them for
# in-memory stubs means the thing you demo is not the thing you deploy.
#
# What makes the sidecar possible at all is that the application does not know
# which of these it is talking to. apps/api resolves REDIS_URL through the
# provider abstraction added in v0.1 (RedisProvider -> ioredis) and never
# branches on where the server lives. `redis://127.0.0.1:6379` and
# `rediss://<primary>.cache.amazonaws.com:6379` are the same code path with two
# strings — the URL scheme alone is what turns TLS on. That abstraction has been
# carrying a small cost since v0.1; this is the invoice it pays.
#
# The tradeoff, stated plainly: a sidecar cache is per-task and ephemeral. Every
# deploy, every task replacement and every crash empties it, which logs every
# user out, because the refresh-token allowlist lives there. Two tasks would each
# get their own and disagree about who is logged in — which is exactly why the
# caller enables the managed cache as soon as more than one task exists.
# ---------------------------------------------------------------------------

locals {
  # "7.1" -> "redis7". ElastiCache families track the major version only.
  cache_parameter_group_family = "redis${split(".", var.cache_engine_version)[0]}"

  cache_node_count = var.cache_replica_count + 1

  # Failover needs somewhere to fail over to. Both flags follow from the replica
  # count rather than being separate switches that can contradict it.
  cache_failover_enabled = var.cache_replica_count > 0
}

resource "aws_elasticache_subnet_group" "this" {
  count = var.managed_cache_enabled ? 1 : 0

  name        = var.names.cache_subnet_group
  description = "Subnets the cache nodes may be placed in."
  subnet_ids  = var.subnet_ids

  tags = {
    Name = var.names.cache_subnet_group
    Tier = "data"
  }
}

resource "aws_elasticache_replication_group" "this" {
  count = var.managed_cache_enabled ? 1 : 0

  replication_group_id = var.names.cache_cluster
  description          = "Shared cache, session store and pub/sub backbone for the API tasks."

  engine               = "redis"
  engine_version       = var.cache_engine_version
  node_type            = var.cache_node_type
  num_cache_clusters   = local.cache_node_count
  parameter_group_name = "default.${local.cache_parameter_group_family}"
  port                 = var.cache_port

  subnet_group_name  = aws_elasticache_subnet_group.this[0].name
  security_group_ids = [var.cache_security_group_id]

  automatic_failover_enabled = local.cache_failover_enabled
  multi_az_enabled           = local.cache_failover_enabled

  # In transit: the cache carries session identifiers and the refresh-token
  # allowlist across the VPC, and TLS costs nothing but the `rediss://` scheme.
  # At rest: free, and it covers the snapshots as well as the nodes.
  transit_encryption_enabled = true
  at_rest_encryption_enabled = true

  snapshot_retention_limit = var.cache_snapshot_retention_days
  maintenance_window       = var.cache_maintenance_window

  auto_minor_version_upgrade = true
  apply_immediately          = false

  tags = {
    Name = var.names.cache_cluster
    Tier = "data"
  }
}
