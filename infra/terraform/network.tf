# ---------------------------------------------------------------------------
# Network
#
# Everything the module needs is resolved here, from local.profile and
# local.names. The module itself never sees var.cost_profile.
# ---------------------------------------------------------------------------

variable "vpc_cidr" {
  description = "IPv4 CIDR block for the VPC. Subnets are carved out of it as /24s — public from index 0, private from index 10. Change it only before the first apply; renumbering a live VPC means recreating it."
  type        = string
  default     = "10.0.0.0/16"

  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0)) && tonumber(split("/", var.vpc_cidr)[1]) <= 20
    error_message = "vpc_cidr must be a valid IPv4 CIDR block of /20 or larger (e.g. 10.0.0.0/16)."
  }
}

variable "enable_nat" {
  description = <<-EOT
    Give the private subnets egress to the internet through NAT gateways.

    DEFAULTS TO FALSE, DELIBERATELY. A NAT gateway costs about $32/month per
    gateway in hourly charges alone (~$0.045/hour, every region) before a single
    byte of data processing is billed on top — and the production profile runs
    one per AZ, so turning this on in a three-AZ stack is roughly $96/month
    standing. It is the most common way a stack that "isn't doing anything"
    quietly bills real money.

    Without it, private subnets still work: they reach the rest of the VPC and
    S3 through the free gateway endpoint, and nothing else. Turn it on when a
    private-subnet workload genuinely needs outbound internet — pulling images
    from a non-ECR registry, calling a third-party API — and expect the bill.

    Ignored unless the cost profile both creates private subnets
    (`private_subnets_enabled`) and budgets for their egress
    (`nat_gateway_enabled`). The demo profile does neither, so it can never
    create a NAT gateway however this is set.
  EOT
  type        = bool
  default     = false
}

variable "interface_endpoints" {
  description = <<-EOT
    AWS service names (short form, e.g. ["ecr.api", "ecr.dkr", "logs",
    "secretsmanager"]) to create interface VPC endpoints for.

    Empty by default. Interface endpoints are not free — roughly $7/month per
    endpoint per AZ plus data processing — so they are named explicitly rather
    than switched on as a set. Ignored by profiles that do not enable VPC
    endpoints, which is how the demo profile stays free of them.
  EOT
  type        = list(string)
  default     = []
}

locals {
  # An explicit key, not nat_gateway_enabled used as a proxy for one. The two
  # were the same flag until Stage D and should not have been: private subnets
  # are route tables and address space, which are free, and NAT egress from them
  # is roughly $32/month per gateway. A stack can legitimately want the first
  # without the second — that is what the interface_endpoints path is for.
  network_private_tier_enabled = local.profile.private_subnets_enabled

  # NAT is the product of three independent conditions: there must be a private
  # tier to attach it to, the profile must budget for the egress, and the
  # operator must have opted into the spend. Demo fails the first two, so
  # `enable_nat = true` there is a no-op rather than a surprise invoice.
  network_nat_gateway_count = (
    local.network_private_tier_enabled && local.profile.nat_gateway_enabled && var.enable_nat
    ? local.profile.nat_gateway_count
    : 0
  )

  # Interface endpoints need both the profile's blessing and an explicit list.
  network_interface_endpoints = local.profile.vpc_endpoints_enabled ? var.interface_endpoints : []

  # Security-group and IAM names are not in local.names (which this file does
  # not own), so they are derived from the same local.name_prefix here. They
  # belong in local.names the next time that file is touched.
  network_security_group_names = {
    alb           = "${local.name_prefix}-alb-sg"
    api           = "${local.name_prefix}-api-sg"
    database      = "${local.name_prefix}-db-sg"
    cache         = "${local.name_prefix}-cache-sg"
    vpc_endpoints = "${local.name_prefix}-vpce-sg"
  }

  network_flow_log_role_name = "${local.name_prefix}-vpc-flow-logs"
}

module "network" {
  source = "./modules/network"

  names = {
    vpc              = local.names.vpc
    internet_gateway = local.names.internet_gateway
    nat_gateway      = local.names.nat_gateway
    public_subnet    = local.names.public_subnet
    private_subnet   = local.names.private_subnet
    flow_log_group   = local.names.flow_log_group
  }
  security_group_names = local.network_security_group_names
  flow_log_role_name   = local.network_flow_log_role_name

  vpc_cidr = var.vpc_cidr
  azs      = local.azs

  private_subnets_enabled = local.network_private_tier_enabled
  nat_gateway_count       = local.network_nat_gateway_count
  interface_endpoints     = local.network_interface_endpoints

  flow_logs_enabled       = local.profile.vpc_flow_logs_enabled
  flow_log_retention_days = local.profile.log_retention_days
}

# ---------------------------------------------------------------------------
# Preflight warnings (soft — hard errors belong in variable validation)
# ---------------------------------------------------------------------------

check "nat_without_private_subnets" {
  assert {
    condition     = !(var.enable_nat && !local.network_private_tier_enabled)
    error_message = "enable_nat is set, but the selected cost profile creates no private subnets — no NAT gateway will be created and nothing will be billed for one. Setting it here has no effect."
  }
}

check "nat_budgeted_without_a_private_tier" {
  assert {
    # Profile coherence, not operator error: a profile that budgets for NAT
    # egress but creates no private subnets has nothing for the gateways to
    # serve, and every workload sits in a public subnet regardless.
    condition     = !(local.profile.nat_gateway_enabled && !local.profile.private_subnets_enabled)
    error_message = "The selected cost profile sets nat_gateway_enabled but leaves private_subnets_enabled false. NAT gateways route egress out of private subnets; with none, no gateway is created and workloads run in the public subnets. Set both keys or neither in local.profile_settings."
  }
}

check "interface_endpoints_ignored" {
  assert {
    condition     = !(length(var.interface_endpoints) > 0 && !local.profile.vpc_endpoints_enabled)
    error_message = "interface_endpoints lists services, but the selected cost profile disables VPC endpoints — none will be created. Interface endpoints cost roughly $7/month per endpoint per AZ, which is why the demo profile leaves them off."
  }
}

# ---------------------------------------------------------------------------
# Outputs consumed by the data, compute and edge stacks
# ---------------------------------------------------------------------------

output "vpc_id" {
  description = "Id of the VPC everything runs in."
  value       = module.network.vpc_id
}

output "vpc_cidr_block" {
  description = "IPv4 CIDR block of the VPC."
  value       = module.network.vpc_cidr_block
}

output "public_subnet_ids" {
  description = "Public subnet ids, one per AZ. The ALB spans these."
  value       = module.network.public_subnet_ids
}

output "private_subnet_ids" {
  description = "Private subnet ids, one per AZ. Empty in profiles without a private tier."
  value       = module.network.private_subnet_ids
}

output "workload_subnet_ids" {
  description = "Subnets ECS tasks, the database and the cache belong in: private where they exist, public otherwise."
  value       = module.network.workload_subnet_ids
}

output "workload_subnets_are_public" {
  description = "True when workloads land in public subnets — ECS services then need assign_public_ip to reach ECR. Ingress is still governed entirely by security groups."
  value       = module.network.workload_subnets_are_public
}

output "alb_security_group_id" {
  description = "Security group for the load balancer — the only one open to the internet."
  value       = module.network.alb_security_group_id
}

output "api_security_group_id" {
  description = "Security group for the API tasks."
  value       = module.network.api_security_group_id
}

output "database_security_group_id" {
  description = "Security group for the database."
  value       = module.network.database_security_group_id
}

output "cache_security_group_id" {
  description = "Security group for the cache."
  value       = module.network.cache_security_group_id
}

output "nat_gateway_public_ips" {
  description = "Egress addresses of the NAT gateways, for third parties that allowlist by source IP. Empty unless NAT was explicitly enabled."
  value       = module.network.nat_gateway_public_ips
}
