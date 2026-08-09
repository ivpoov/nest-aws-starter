# Inputs are all resolved by the caller from local.names and local.profile.
# Nothing in here reads var.cost_profile, and nothing in here invents a name.

variable "sites" {
  description = <<-EOT
    The static sites to publish, keyed by short name (e.g. "web", "admin").

      bucket_name — globally unique S3 bucket name, from the caller's local.names
      hostnames   — custom hostnames to serve the site on; empty list to run on
                    the AWS-assigned *.cloudfront.net hostname
      comment     — human-readable suffix for the distribution comment
  EOT

  type = map(object({
    bucket_name = string
    hostnames   = optional(list(string), [])
    comment     = optional(string, "")
  }))

  validation {
    condition     = length(var.sites) > 0
    error_message = "sites must contain at least one entry."
  }
}

variable "domain_name" {
  description = "Apex domain the stack serves from, or null to run entirely on AWS-assigned hostnames (no ACM certificate, no hosted zone, no alias records)."
  type        = string
  default     = null
}

variable "hosted_zone_id" {
  description = "Existing Route 53 public hosted zone to write records into. Null with a domain_name set means the module creates the zone itself, and you delegate to its name servers at the registrar."
  type        = string
  default     = null
}

variable "price_class" {
  description = "CloudFront price class, from the caller's cost profile."
  type        = string
  default     = "PriceClass_100"

  validation {
    condition     = contains(["PriceClass_100", "PriceClass_200", "PriceClass_All"], var.price_class)
    error_message = "price_class must be PriceClass_100, PriceClass_200 or PriceClass_All."
  }
}

variable "force_destroy" {
  description = "Whether the site buckets may be emptied on destroy, from the caller's cost profile. A disposable stack whose destroy fails on a non-empty bucket is not disposable."
  type        = bool
  default     = false
}

variable "noncurrent_version_expiration_days" {
  description = "How long superseded objects survive. Site buckets are versioned so a bad deploy can be rolled back, but every deploy supersedes the whole bundle, so old versions must expire or the bucket grows without bound."
  type        = number
  default     = 30

  validation {
    condition     = var.noncurrent_version_expiration_days >= 1
    error_message = "noncurrent_version_expiration_days must be at least 1."
  }
}

variable "immutable_path_patterns" {
  description = "Path patterns served with a long cache lifetime. These must only ever match content-hashed filenames — Vite writes those to /assets/ by default. Everything not listed here (index.html and every client-side route) is served no-cache."
  type        = list(string)
  default     = ["/assets/*"]
}

variable "logging_enabled" {
  description = "Whether to write CloudFront access logs, from the caller's cost profile. Requires log_bucket_domain_name; logging is skipped when no bucket is supplied."
  type        = bool
  default     = false
}

variable "log_bucket_domain_name" {
  description = "Bucket domain name for CloudFront access logs (e.g. my-logs.s3.amazonaws.com). The bucket must have ACLs enabled — CloudFront standard logging still writes with an ACL grant."
  type        = string
  default     = null
}

variable "web_acl_arn" {
  description = "ARN of a CLOUDFRONT-scoped WAFv2 web ACL to associate, or null. Not created here: a web ACL is shared across distributions and belongs to whichever module owns it."
  type        = string
  default     = null
}

variable "comment_prefix" {
  description = "Prefix for every distribution comment, from the caller's local.names."
  type        = string
}

variable "api_distribution_enabled" {
  description = "Whether to put a third distribution in front of the ALB. Off by default — see the trade-off written out at the top of api.tf."
  type        = bool
  default     = false

  validation {
    condition     = !var.api_distribution_enabled || var.alb_dns_name != null
    error_message = "api_distribution_enabled requires alb_dns_name — there is nothing to put a distribution in front of."
  }
}

variable "alb_dns_name" {
  description = "DNS name of the load balancer to use as the API origin, from the compute module. Null when there is nothing to front."
  type        = string
  default     = null
}

variable "api_hostnames" {
  description = "Custom hostnames for the API distribution. Empty to serve on the AWS-assigned CloudFront hostname."
  type        = list(string)
  default     = []
}

variable "alb_origin_protocol_policy" {
  description = "How CloudFront reaches the ALB. http-only is the default because an ALB's own *.elb.amazonaws.com hostname has no certificate CloudFront can validate; move to https-only once the listener carries an ACM certificate for a verifiable name."
  type        = string
  default     = "http-only"

  validation {
    condition     = contains(["http-only", "https-only", "match-viewer"], var.alb_origin_protocol_policy)
    error_message = "alb_origin_protocol_policy must be http-only, https-only or match-viewer."
  }
}
