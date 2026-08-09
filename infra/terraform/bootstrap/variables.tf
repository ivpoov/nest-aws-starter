variable "project_name" {
  description = "Project slug. Used as the prefix of the state bucket name, so it must be DNS-safe."
  type        = string
  default     = "nest-aws-starter"

  validation {
    condition     = can(regex("^[a-z][a-z0-9]*(-[a-z0-9]+)*$", var.project_name)) && length(var.project_name) <= 24
    error_message = "project_name must be lowercase alphanumeric with single dashes between segments, at most 24 characters (S3 bucket naming rules)."
  }
}

variable "aws_region" {
  description = "Region the state bucket lives in. Every environment shares one state bucket, so this is a one-time decision."
  type        = string
  default     = "us-east-1"

  validation {
    condition     = can(regex("^[a-z]{2}(-gov)?-[a-z]+-[0-9]$", var.aws_region))
    error_message = "aws_region must look like an AWS region id, e.g. us-east-1 or eu-central-1."
  }
}

variable "profile" {
  description = "Named AWS CLI profile to authenticate with. Leave null to use the ambient credential chain (env vars, SSO, instance role)."
  type        = string
  default     = null
}

variable "noncurrent_version_retention_days" {
  description = "How long superseded state file versions are kept. Old versions are the recovery path after a bad apply, so do not set this too low."
  type        = number
  default     = 90

  validation {
    condition     = var.noncurrent_version_retention_days >= 7
    error_message = "noncurrent_version_retention_days must be at least 7 — shorter windows leave no room to recover from a corrupted state file."
  }
}

variable "force_destroy" {
  description = "Allow `terraform destroy` to delete the state bucket even when it still holds state files. Only ever true for a throwaway demo account."
  type        = bool
  default     = false
}
