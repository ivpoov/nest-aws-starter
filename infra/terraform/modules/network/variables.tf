# Every input here is resolved by the caller from local.profile and local.names.
# This module deliberately knows nothing about cost profiles: it takes counts,
# flags and names, and it never compares var.cost_profile (which it cannot even
# see). Adding a knob means adding a key to local.profile_settings in the root
# stack and threading it through as an input — never an `if` in here.

variable "names" {
  description = "Resource names, taken from local.names in the root stack. Nothing in this module is hand-named."
  type = object({
    vpc              = string
    internet_gateway = string
    nat_gateway      = string
    public_subnet    = string
    private_subnet   = string
    flow_log_group   = string
  })
}

variable "security_group_names" {
  description = "Names for the four tiers of the security-group chain plus the interface-endpoint group. Supplied by the caller so all naming stays in one place."
  type = object({
    alb           = string
    api           = string
    database      = string
    cache         = string
    vpc_endpoints = string
  })
}

variable "flow_log_role_name" {
  description = "Name of the IAM role VPC Flow Logs assumes to write into CloudWatch Logs. Only used when flow_logs_enabled is true."
  type        = string
}

variable "vpc_cidr" {
  description = "IPv4 CIDR block for the VPC. Subnets are carved out of it as /24s: public subnets from index 0 upwards, private subnets from index 10 upwards."
  type        = string

  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0)) && tonumber(split("/", var.vpc_cidr)[1]) <= 20
    error_message = "vpc_cidr must be a valid IPv4 CIDR block of /20 or larger (e.g. 10.0.0.0/16) — the subnet layout carves /24s out of it."
  }
}

variable "azs" {
  description = "Availability zones to spread subnets across, in order. One public subnet per zone, and one private subnet per zone when the private tier is enabled."
  type        = list(string)

  validation {
    # An ALB needs subnets in at least two zones, and so does an RDS subnet
    # group — a single-AZ VPC cannot host either, whatever the cost profile.
    condition     = length(var.azs) >= 2
    error_message = "azs must contain at least two availability zones: both the ALB and the RDS subnet group require two."
  }
}

variable "private_subnets_enabled" {
  description = "Create the private subnet tier (one per AZ) with its own route tables. Private subnets themselves are free; egress from them is not — see nat_gateway_count."
  type        = bool
  default     = false
}

variable "nat_gateway_count" {
  description = <<-EOT
    Number of NAT gateways to create, one per AZ in order. Zero means the private
    subnets have no default route: instances in them can reach the VPC and any
    gateway endpoints, and nothing else.

    A NAT gateway costs roughly $32/month per gateway in hourly charges alone
    (~$0.045/hour) before a single byte of data processing is billed on top. It
    is the single largest fixed cost in a small stack, which is why the caller
    has to ask for it explicitly rather than inheriting it from a profile.
  EOT
  type        = number
  default     = 0

  validation {
    condition     = var.nat_gateway_count >= 0
    error_message = "nat_gateway_count must be zero or greater."
  }
}

variable "api_container_port" {
  description = "Port the API container listens on. The ALB reaches the API task on this port and nothing else does."
  type        = number
  default     = 3000
}

variable "database_port" {
  description = "Port the managed database listens on (PostgreSQL)."
  type        = number
  default     = 5432
}

variable "cache_port" {
  description = "Port the managed cache listens on (Redis)."
  type        = number
  default     = 6379
}

variable "interface_endpoints" {
  description = <<-EOT
    AWS service names (the short form, e.g. "ecr.api", "secretsmanager") to
    create interface VPC endpoints for, in the private subnets.

    Empty by default and empty in the demo profile: unlike the S3 gateway
    endpoint, interface endpoints are NOT free — roughly $7/month per endpoint
    per AZ plus data processing. Three endpoints across three AZs is more than a
    NAT gateway. They pay for themselves only for private-subnet workloads with
    real egress volume, so they are opt-in rather than a silent default.
  EOT
  type        = list(string)
  default     = []
}

variable "flow_logs_enabled" {
  description = "Send VPC flow logs to CloudWatch Logs. Off in the demo profile — flow logs are billed on ingestion and storage, and a demo stack has nothing to investigate."
  type        = bool
  default     = false
}

variable "flow_log_retention_days" {
  description = "Retention for the flow log group. Ignored when flow_logs_enabled is false."
  type        = number
  default     = 7
}
