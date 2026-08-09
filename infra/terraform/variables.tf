# Core inputs for the whole stack — the ones more than one module cares about.
# Every other variable is declared in the root file that wires the module it
# configures, so a variable and its only consumer stay together.
#
# No module reads these directly. They feed locals.tf, and the modules read
# local.profile.<key> and local.names from there — see locals.tf for why.

variable "project_name" {
  description = "Project slug. Prefixes every resource name and lands in the Project tag, so it must be DNS-safe (S3, ALB and ECR names all derive from it)."
  type        = string
  default     = "nest-aws-starter"

  validation {
    condition     = can(regex("^[a-z][a-z0-9]*(-[a-z0-9]+)*$", var.project_name)) && length(var.project_name) <= 24
    error_message = "project_name must be lowercase alphanumeric with single dashes between segments, at most 24 characters (S3 and ALB naming rules)."
  }
}

variable "environment" {
  description = "Environment slug — one Terraform workspace/state key per environment. Part of every resource name and the Environment tag."
  type        = string
  default     = "dev"

  validation {
    # No dashes: environment is a name segment, and dashes here make the derived
    # names in locals.tf ambiguous to parse back apart.
    condition     = can(regex("^[a-z][a-z0-9]{0,11}$", var.environment))
    error_message = "environment must be lowercase alphanumeric, start with a letter, and be at most 12 characters (e.g. dev, staging, prod)."
  }
}

variable "aws_region" {
  description = "Region everything is deployed into."
  type        = string
  default     = "us-east-1"

  validation {
    condition     = can(regex("^[a-z]{2}(-gov)?-[a-z]+-[0-9]$", var.aws_region))
    error_message = "aws_region must look like an AWS region id, e.g. us-east-1 or eu-central-1."
  }
}

variable "profile" {
  description = "Named AWS CLI profile to authenticate with. Leave null to use the ambient credential chain (env vars, SSO, CI role assumption)."
  type        = string
  default     = null
}

variable "cost_profile" {
  description = <<-EOT
    Selects the cost/durability posture of the whole stack from a single knob.

      demo       — cheapest thing that runs end to end, and disposable with it:
                   no NAT gateway, single AZ where AWS allows it, smallest
                   instance classes, Fargate Spot, minimal retention, no
                   deletion protection. Expect to tear it down.
      production — managed and durable: NAT egress, multi-AZ, automated backups
                   with real retention, deletion protection, access logs,
                   alarms. Not a WAF: no module creates one, so the key stays
                   false on both profiles — see docs/guides/production.md §5.

    The two profiles run the *same* code with different inputs. If you ever feel
    the need to branch on cost_profile inside a module, add a key to
    local.profile_settings in locals.tf instead.
  EOT
  type        = string
  default     = "demo"

  validation {
    condition     = contains(["demo", "production"], var.cost_profile)
    error_message = "cost_profile must be either \"demo\" or \"production\"."
  }
}

variable "domain_name" {
  description = "Apex domain to serve the app from, e.g. example.com. Leave null to run on the AWS-assigned CloudFront/ALB hostnames with no ACM certificate or Route 53 zone."
  type        = string
  default     = null

  validation {
    condition     = var.domain_name == null || can(regex("^([a-z0-9]([a-z0-9-]*[a-z0-9])?\\.)+[a-z]{2,}$", var.domain_name))
    error_message = "domain_name must be a lowercase fully qualified domain name (e.g. example.com), or null."
  }
}

variable "alert_email" {
  description = "Address subscribed to the alerting SNS topic. AWS sends a confirmation mail that must be clicked before anything is delivered."
  type        = string
  default     = null

  validation {
    condition     = var.alert_email == null || can(regex("^[^@\\s]+@[^@\\s]+\\.[a-z]{2,}$", var.alert_email))
    error_message = "alert_email must be a valid email address, or null."
  }

  validation {
    # A production deployment with no route for alarms to reach a human is a
    # failure mode worth blocking at plan time.
    condition     = var.cost_profile != "production" || var.alert_email != null
    error_message = "alert_email is required when cost_profile is \"production\" — production alarms need somewhere to go."
  }
}
