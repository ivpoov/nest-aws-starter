# Alias records, one A and one AAAA per hostname. Alias rather than CNAME so the
# apex works too — a CNAME at the zone apex is illegal DNS, and this is where
# "example.com doesn't resolve but www does" comes from.
#
# The hosted zone id below is CloudFront's own fixed, global id, not the stack's.

locals {
  cloudfront_hosted_zone_id = "Z2FDTNDATAQYW2"
}

resource "aws_route53_record" "site_ipv4" {
  for_each = local.custom_domain_enabled ? local.site_alias_records : {}

  zone_id = local.hosted_zone_id
  name    = each.value.host
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.site[each.value.site].domain_name
    zone_id                = local.cloudfront_hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "site_ipv6" {
  for_each = local.custom_domain_enabled ? local.site_alias_records : {}

  zone_id = local.hosted_zone_id
  name    = each.value.host
  type    = "AAAA"

  alias {
    name                   = aws_cloudfront_distribution.site[each.value.site].domain_name
    zone_id                = local.cloudfront_hosted_zone_id
    evaluate_target_health = false
  }
}
