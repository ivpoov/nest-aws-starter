# ---------------------------------------------------------------------------
# Edge — the two frontends.
#
# apps/web and apps/admin are static Vite builds: a folder of hashed files and
# an index.html. There is no compute here, and there should not be. Each one is
# a private S3 bucket read exclusively by a CloudFront distribution through
# Origin Access Control. See modules/edge/README.md for the caching split, the
# custom-domain path and the ALB trade-off.
# ---------------------------------------------------------------------------

# CloudFront certificates, and only CloudFront certificates, must live in
# us-east-1 regardless of var.aws_region. Declared here rather than in
# providers.tf because the edge module is its only consumer.
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  profile = var.profile

  default_tags {
    tags = local.default_tags
  }
}

locals {
  # Hostnames, derived once. All empty when domain_name is null, which is what
  # switches the module's whole ACM/Route 53 path off — the distributions then
  # serve on their AWS-assigned *.cloudfront.net hostnames, which are still
  # HTTPS on an AWS-managed certificate.
  edge_hostnames = var.domain_name == null ? {
    web   = []
    admin = []
    api   = []
    } : {
    web   = [var.domain_name, "www.${var.domain_name}"]
    admin = ["admin.${var.domain_name}"]
    api   = ["api.${var.domain_name}"]
  }

  # Site bucket names follow local.names' convention — <prefix>-<role>-<account>
  # — built from local.name_prefix the same way the per-instance names in
  # locals.tf are.
  edge_site_buckets = {
    web   = "${local.name_prefix}-web-${local.bucket_suffix}"
    admin = "${local.name_prefix}-admin-${local.bucket_suffix}"
  }

  # Put CloudFront in front of the ALB as well? Off, deliberately — the full
  # trade-off is written out at the top of modules/edge/api.tf. The short
  # version: it buys HTTPS on the API without owning a domain and lets the ALB
  # be closed to everything but CloudFront, and it costs a hop, per-request
  # charges on uncacheable traffic, and the API's direct view of client IPs.
  #
  # Turning it on is two edits: flip this to true, and set edge_alb_dns_name to
  # the load balancer's DNS name from the compute module.
  edge_api_distribution_enabled = false
  edge_alb_dns_name             = null

  # Two things the edge consumes but does not own, both null until the modules
  # that do own them land. The check block at the bottom of this file is what
  # stops that from being silent on a profile that asked for them.
  #
  #   - the access-log bucket (local.names.logs_bucket) belongs to shared
  #     storage, and must have ACLs enabled: CloudFront standard logging still
  #     delivers with an ACL grant, so a BucketOwnerEnforced bucket rejects it
  #   - the web ACL (local.names.waf_web_acl) is shared across distributions,
  #     and for CloudFront must itself be created in us-east-1 with CLOUDFRONT
  #     scope
  edge_log_bucket_domain_name = null
  edge_web_acl_arn            = null
}

module "edge" {
  source = "./modules/edge"

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  comment_prefix = local.names.cloudfront_comment

  sites = {
    web = {
      bucket_name = local.edge_site_buckets.web
      hostnames   = local.edge_hostnames.web
      comment     = "(web)"
    }
    admin = {
      bucket_name = local.edge_site_buckets.admin
      hostnames   = local.edge_hostnames.admin
      comment     = "(admin)"
    }
  }

  domain_name = var.domain_name
  price_class = local.profile.cloudfront_price_class

  logging_enabled        = local.profile.cloudfront_logs_enabled
  log_bucket_domain_name = local.edge_log_bucket_domain_name
  web_acl_arn            = local.edge_web_acl_arn

  api_distribution_enabled = local.edge_api_distribution_enabled
  alb_dns_name             = local.edge_alb_dns_name
  api_hostnames            = local.edge_hostnames.api

  # A disposable stack has to be disposable: on the demo profile the buckets are
  # emptied on destroy, so `terraform destroy` does not stop on a bucket full of
  # last week's build.
  force_destroy = local.profile.force_destroy_bucket
}

# ---------------------------------------------------------------------------
# Outputs
#
# These exist so no URL in this project is ever hand-copied: the deploy workflow
# reads the bucket and distribution ids from here, the frontends are built with
# the API base URL from here, and the API's CORS_ORIGINS is generated from here.
# ---------------------------------------------------------------------------

output "web_bucket_name" {
  description = "Bucket to sync apps/web's dist/ into."
  value       = module.edge.site_bucket_names["web"]
}

output "admin_bucket_name" {
  description = "Bucket to sync apps/admin's dist/ into."
  value       = module.edge.site_bucket_names["admin"]
}

output "web_distribution_id" {
  description = "Distribution to invalidate after deploying apps/web."
  value       = module.edge.site_distribution_ids["web"]
}

output "admin_distribution_id" {
  description = "Distribution to invalidate after deploying apps/admin."
  value       = module.edge.site_distribution_ids["admin"]
}

output "web_url" {
  description = "Public URL of the web frontend."
  value       = module.edge.site_urls["web"]
}

output "admin_url" {
  description = "Public URL of the admin frontend."
  value       = module.edge.site_urls["admin"]
}

output "edge_certificate_arn" {
  description = "us-east-1 ACM certificate covering every custom hostname, or null when domain_name is unset."
  value       = module.edge.certificate_arn
}

output "edge_hosted_zone_name_servers" {
  description = "Name servers of the hosted zone this stack created. Delegate to these at your registrar — certificate validation cannot complete until you do."
  value       = module.edge.hosted_zone_name_servers
}

output "api_distribution_id" {
  description = "Distribution in front of the ALB, or null when it is disabled."
  value       = module.edge.api_distribution_id
}

output "api_edge_url" {
  description = "Origin the API is reachable on through the edge, or null when the API distribution is disabled — in which case the API is reached at the load balancer directly."
  value       = module.edge.api_url
}

output "frontend_build_env" {
  description = <<-EOT
    Build-time environment for both Vite frontends. The deploy workflow reads
    this and exports it before `pnpm build`; nothing here is ever pasted by
    hand. VITE_API_BASE_URL is null when the API distribution is disabled — the
    workflow then falls back to the load balancer URL the compute module
    exports, which is the one URL this module cannot know.
  EOT

  value = {
    # API_PREFIX defaults to "api" and URI versioning defaults to v1, so the
    # frontends' base URL is the origin plus /api/v1.
    VITE_API_BASE_URL = module.edge.api_url == null ? null : "${module.edge.api_url}/api/v1"

    # apps/admin links back to the public site.
    VITE_WEB_APP_URL = module.edge.site_urls["web"]
  }
}

output "api_cors_origins" {
  description = "Value for the API's CORS_ORIGINS environment variable: every origin the frontends are served from, comma-separated, no spaces."
  value       = join(",", module.edge.cors_origins)
}

# A cost profile that asks for edge logging or a web ACL and gets neither is
# worse than one that never asked: the setting reads as enabled everywhere it is
# shown. Warn on plan rather than fail — the modules that own these resources
# land separately, and a stack should still be applyable in between.
check "edge_supporting_resources" {
  assert {
    condition     = !(local.profile.cloudfront_logs_enabled && local.edge_log_bucket_domain_name == null)
    error_message = "The selected cost profile enables CloudFront access logs, but no log bucket is wired into the edge module — no logs will be delivered."
  }

  assert {
    condition     = !(local.profile.waf_enabled && local.edge_web_acl_arn == null)
    error_message = "The selected cost profile enables WAF, but no web ACL is wired into the edge module — the distributions are unprotected."
  }
}
