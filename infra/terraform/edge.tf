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

  logging_enabled = local.profile.cloudfront_logs_enabled

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

output "api_cors_origins" {
  description = "Value for the API's CORS_ORIGINS environment variable: every origin the frontends are served from, comma-separated, no spaces."
  value       = join(",", module.edge.cors_origins)
}
