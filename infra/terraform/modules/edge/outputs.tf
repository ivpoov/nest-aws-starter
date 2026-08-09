locals {
  # The URL a human (and the deploy workflow's smoke check) should use for each
  # site: the first configured hostname when there is one, the AWS-assigned
  # CloudFront hostname otherwise.
  site_urls = {
    for name, site in var.sites :
    name => local.custom_domain_enabled && length(site.hostnames) > 0
    ? "https://${site.hostnames[0]}"
    : "https://${aws_cloudfront_distribution.site[name].domain_name}"
  }

  # Every origin a browser can legitimately load a frontend from, including the
  # *.cloudfront.net hostnames — those keep working after a domain is attached,
  # and an API that rejects them turns "let me check the raw CloudFront URL"
  # into a confusing CORS failure.
  cors_origins = sort(distinct(concat(
    [for name, site in var.sites : "https://${aws_cloudfront_distribution.site[name].domain_name}"],
    [for host in local.site_hostnames : "https://${host}"],
  )))
}

output "site_bucket_names" {
  description = "Bucket to sync each built site into, keyed by site name. The deploy workflow's `aws s3 sync` target."
  value       = { for name, bucket in aws_s3_bucket.site : name => bucket.bucket }
}

output "site_bucket_arns" {
  description = "ARNs of the site buckets, keyed by site name. Scope the deploy role's write permissions to these."
  value       = { for name, bucket in aws_s3_bucket.site : name => bucket.arn }
}

output "site_distribution_ids" {
  description = "Distribution to invalidate after each sync, keyed by site name. Invalidating /index.html is not optional even with a no-cache shell — browsers hold their own copy."
  value       = { for name, distribution in aws_cloudfront_distribution.site : name => distribution.id }
}

output "site_distribution_domain_names" {
  description = "AWS-assigned <id>.cloudfront.net hostname of each distribution, keyed by site name."
  value       = { for name, distribution in aws_cloudfront_distribution.site : name => distribution.domain_name }
}

output "site_urls" {
  description = "Public URL of each site, keyed by site name — the custom hostname when one is configured, the CloudFront hostname otherwise."
  value       = local.site_urls
}

output "cors_origins" {
  description = "Every browser origin the frontends are served from. Feeds the API's CORS_ORIGINS."
  value       = local.cors_origins
}

output "certificate_arn" {
  description = "ARN of the us-east-1 ACM certificate covering every custom hostname, or null when no domain is configured."
  value       = local.certificate_arn
}

output "hosted_zone_id" {
  description = "Route 53 zone the records live in, or null when no domain is configured."
  value       = local.custom_domain_enabled ? local.hosted_zone_id : null
}

output "hosted_zone_name_servers" {
  description = "Name servers of the zone created by this module. Delegate to these at your registrar — until you do, certificate validation cannot complete and apply will time out. Empty when the zone was supplied rather than created."
  value       = try(one(aws_route53_zone.primary[*].name_servers), [])
}
