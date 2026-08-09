# ---------------------------------------------------------------------------
# Identity and tags
# ---------------------------------------------------------------------------

locals {
  account_id = data.aws_caller_identity.current.account_id
  region     = data.aws_region.current.region
  partition  = data.aws_partition.current.partition

  # The single prefix every derived name starts with, e.g. "myapp-dev".
  name_prefix = "${var.project_name}-${var.environment}"

  # S3 bucket names are globally unique across all of AWS; the account id is
  # what stops a fork of this repository from colliding with yours.
  bucket_suffix = local.account_id

  default_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
    CostProfile = var.cost_profile
  }

  azs = slice(data.aws_availability_zones.available.names, 0, local.profile.az_count)
}

# ---------------------------------------------------------------------------
# Cost profile
#
# The one place demo and production differ. Everything downstream reads
# local.profile.<key>; no module anywhere in infra/ should compare
# var.cost_profile itself. When a later module needs a knob that differs
# between the two postures, add a key to BOTH maps below rather than branching
# in the module — that is what keeps this a single codebase with two sets of
# inputs instead of two codebases.
# ---------------------------------------------------------------------------

locals {
  profile_settings = {
    demo = {
      # network
      #
      # private_subnets_enabled and nat_gateway_enabled are two keys because
      # they are two decisions. Private subnets are free — they are route
      # tables and address space — and egress from them is not. Keying the
      # tier off the NAT flag, as this file used to, made "I want workloads
      # off the public internet" and "I am willing to pay ~$32/month per AZ
      # for their egress" the same sentence.
      az_count                = 2 # ALB and RDS subnet groups both require >= 2
      private_subnets_enabled = false
      nat_gateway_enabled     = false
      nat_gateway_count       = 0 # NAT is the single largest fixed cost in a small stack
      vpc_endpoints_enabled   = false
      vpc_flow_logs_enabled   = false

      # data
      #
      # managed_cache_enabled is its own key and not a function of the task
      # count, deliberately. false means Redis runs as a container beside the
      # API in the same task: free, per-task, and emptied by every deploy. true
      # means an ElastiCache replication group at roughly $12/month, which is
      # about 40% of what this whole profile costs — far too large a bill to
      # arrive as a side effect of editing a capacity number.
      #
      # A per-task cache is correct exactly while there is one task, so this key
      # and compute_max_capacity below move together. See the note there.
      managed_cache_enabled          = false
      database_instance_class        = "db.t4g.micro"
      database_allocated_storage_gb  = 20
      database_multi_az              = false
      database_backup_retention_days = 1
      database_performance_insights  = false
      cache_node_type                = "cache.t4g.micro"
      cache_replica_count            = 0

      # compute
      #
      # One task, and therefore a sidecar cache above. Two pieces of apps/api
      # are no-ops at one task — the scheduler's Redis lock and the Socket.IO
      # Redis adapter — so proving they work across instances needs BOTH keys
      # raised together:
      #
      #   managed_cache_enabled = true   (shared cache, ~$12/month)
      #   compute_min/max_capacity = 2   (second Fargate Spot task, ~$3/month)
      #
      # Raising the capacity alone gives two tasks with two private sidecars,
      # which disagree about who is logged in. The check in datastores.tf is
      # what says so on plan. README.md walks through the run and the cost.
      compute_use_fargate_spot = true
      compute_task_cpu         = 256
      compute_task_memory      = 512
      compute_desired_count    = 1
      compute_autoscaling      = false
      compute_min_capacity     = 1
      compute_max_capacity     = 1

      # edge
      waf_enabled             = false
      cloudfront_price_class  = "PriceClass_100"
      cloudfront_logs_enabled = false

      # observability
      log_retention_days        = 7
      container_insights        = false
      alarms_enabled            = false
      synthetics_canary_enabled = false

      # lifecycle — demo is meant to be thrown away
      deletion_protection    = false
      force_destroy_bucket   = true
      skip_final_snapshot    = true
      custom_domain_expected = false
    }

    production = {
      # network
      az_count                = 3
      private_subnets_enabled = true
      nat_gateway_enabled     = true
      nat_gateway_count       = 3 # one per AZ: a shared NAT is a cross-AZ SPOF
      vpc_endpoints_enabled   = true
      vpc_flow_logs_enabled   = true

      # data
      #
      # A shared cache, because this profile runs more than one task and a
      # per-task sidecar would sign users out every time a task was replaced.
      managed_cache_enabled          = true
      database_instance_class        = "db.t4g.small"
      database_allocated_storage_gb  = 50
      database_multi_az              = true
      database_backup_retention_days = 14
      database_performance_insights  = true
      cache_node_type                = "cache.t4g.small"
      cache_replica_count            = 1

      # compute
      compute_use_fargate_spot = false
      compute_task_cpu         = 512
      compute_task_memory      = 1024
      compute_desired_count    = 2
      compute_autoscaling      = true
      compute_min_capacity     = 2
      compute_max_capacity     = 6

      # edge
      waf_enabled             = true
      cloudfront_price_class  = "PriceClass_All"
      cloudfront_logs_enabled = true

      # observability
      log_retention_days        = 30
      container_insights        = true
      alarms_enabled            = true
      synthetics_canary_enabled = false

      # lifecycle
      deletion_protection    = true
      force_destroy_bucket   = false
      skip_final_snapshot    = false
      custom_domain_expected = true
    }
  }

  profile = local.profile_settings[var.cost_profile]
}

# ---------------------------------------------------------------------------
# Derived names
#
# Nothing in Stage D is hand-named. Every module takes its names from this map
# (or builds them from local.name_prefix for names that are per-instance, e.g.
# one log group per service). Adding a resource means adding a key here first.
#
# Watch the AWS length limits noted inline — a long project_name plus a long
# environment can overflow them, hence the substr() guards.
# ---------------------------------------------------------------------------

locals {
  names = {
    # network
    vpc                          = "${local.name_prefix}-vpc"
    internet_gateway             = "${local.name_prefix}-igw"
    nat_gateway                  = "${local.name_prefix}-nat"
    public_subnet                = "${local.name_prefix}-public"
    private_subnet               = "${local.name_prefix}-private"
    isolated_subnet              = "${local.name_prefix}-isolated"
    flow_log_group               = "/aws/vpc/${local.name_prefix}"
    flow_log_role                = "${local.name_prefix}-vpc-flow-logs"
    security_group_alb           = "${local.name_prefix}-alb-sg"
    security_group_api           = "${local.name_prefix}-api-sg"
    security_group_database      = "${local.name_prefix}-db-sg"
    security_group_cache         = "${local.name_prefix}-cache-sg"
    security_group_vpc_endpoints = "${local.name_prefix}-vpce-sg"

    # data
    database_identifier      = "${local.name_prefix}-db"
    database_subnet_group    = "${local.name_prefix}-db-subnets"
    database_parameter_group = "${local.name_prefix}-db-params"
    database_secret          = "${local.secret_prefix}/database"
    cache_cluster            = substr("${local.name_prefix}-cache", 0, 40) # ElastiCache: 40
    cache_subnet_group       = "${local.name_prefix}-cache-subnets"
    assets_bucket            = "${local.name_prefix}-assets-${local.bucket_suffix}"
    uploads_bucket           = "${local.name_prefix}-uploads-${local.bucket_suffix}"
    logs_bucket              = "${local.name_prefix}-logs-${local.bucket_suffix}"

    # compute
    ecs_cluster            = "${local.name_prefix}-cluster"
    ecr_api                = "${local.name_prefix}/api"
    ecr_web                = "${local.name_prefix}/web"
    task_definition_api    = "${local.name_prefix}-api"
    ecs_service_api        = "${local.name_prefix}-api"
    alb                    = substr("${local.name_prefix}-alb", 0, 32)    # ELBv2: 32
    target_group_api       = substr("${local.name_prefix}-api-tg", 0, 32) # ELBv2: 32
    migrations_task        = "${local.name_prefix}-migrations"
    autoscaling_cpu_policy = "${local.name_prefix}-api-cpu"

    # services (queues, notifications)
    #
    # The queue was called `events` on the theory that a second producer could
    # share it. Nothing else produces to it, one consumer reads it
    # (PaymentWebhookConsumerService), and its dead letters are payment
    # webhooks — so it is named for what it carries. A second producer with
    # different retry semantics wants its own queue anyway.
    payment_webhook_queue = "${local.name_prefix}-payment-webhook"
    payment_webhook_dlq   = "${local.name_prefix}-payment-webhook-dlq"
    notifications_topic   = "${local.name_prefix}-notifications"

    # edge
    cloudfront_comment = "${local.name_prefix} distribution"
    waf_web_acl        = "${local.name_prefix}-waf"
    web_bucket         = "${local.name_prefix}-web-${local.bucket_suffix}"
    admin_bucket       = "${local.name_prefix}-admin-${local.bucket_suffix}"

    # observability
    #
    # Every log group under local.ecs_log_group_prefix on purpose: that is the
    # prefix the execution role's CreateLogStream statement is scoped to, and a
    # group outside it fails to open a stream.
    alerts_topic         = "${local.name_prefix}-alerts"
    dashboard            = "${local.name_prefix}-overview"
    api_log_group        = "${local.ecs_log_group_prefix}/api"
    web_log_group        = "${local.ecs_log_group_prefix}/web"
    migrations_log_group = "${local.ecs_log_group_prefix}/migrations"
    budget               = "${local.name_prefix}-monthly"
    error_metric_filter  = "${local.name_prefix}-api-errors"

    alarm_api_no_healthy_hosts  = "${local.name_prefix}-api-no-healthy-hosts"
    alarm_ecs_no_running_tasks  = "${local.name_prefix}-api-no-running-tasks"
    alarm_alb_5xx_rate          = "${local.name_prefix}-api-5xx-rate"
    alarm_api_error_logs        = "${local.name_prefix}-api-error-logs"
    alarm_database_cpu          = "${local.name_prefix}-database-cpu"
    alarm_database_free_storage = "${local.name_prefix}-database-free-storage"
    alarm_webhook_dlq_depth     = "${local.name_prefix}-webhook-dlq-depth"

    # ci/cd
    artifacts_bucket          = "${local.name_prefix}-artifacts-${local.bucket_suffix}"
    deploy_role               = "${local.name_prefix}-deploy"
    github_oidc_role          = "${local.name_prefix}-github-actions"
    deploy_manifest_parameter = "${local.secret_prefix}/cicd/deploy-manifest"
    task_execution_role       = "${local.name_prefix}-task-execution"
    task_role                 = "${local.name_prefix}-task"
  }

  # Namespace for SSM parameters and Secrets Manager secrets. Leading slash,
  # no trailing slash — consumers append "/name".
  secret_prefix = "/${var.project_name}/${var.environment}"

  # Prefix every ECS log group hangs off. Named once here because two things
  # depend on it agreeing with itself: the group names above, and the wildcard
  # the task execution role's CreateLogStream statement is scoped to.
  ecs_log_group_prefix = "/aws/ecs/${local.name_prefix}"
}
