# ---------------------------------------------------------------------------
# Custom domain — everything in this file is skipped when domain_name is null.
#
# Without a domain the distributions serve on their AWS-assigned
# <id>.cloudfront.net hostnames, which are still HTTPS with a certificate AWS
# manages for free. That is a perfectly good demo posture, not a degraded one.
#
# THE ONE THING THAT TRIPS EVERYONE: a certificate used by CloudFront must live
# in us-east-1, no matter which region the rest of the stack runs in. Hence the
# aws.us_east_1 provider alias on the two resources below — and only on those
# two. An ACM certificate created in the stack's own region cannot be attached
# to a distribution, and the error you get says nothing about regions.
# ---------------------------------------------------------------------------

resource "aws_route53_zone" "primary" {
  count = var.domain_name != null && var.hosted_zone_id == null ? 1 : 0

  name    = var.domain_name
  comment = "${var.comment_prefix} — public zone"
}

resource "aws_acm_certificate" "edge" {
  count = local.custom_domain_enabled ? 1 : 0

  provider = aws.us_east_1

  domain_name               = local.certificate_names[0]
  subject_alternative_names = slice(local.certificate_names, 1, length(local.certificate_names))
  validation_method         = "DNS"

  lifecycle {
    # A certificate cannot be replaced while a distribution references it, so
    # the new one has to exist before the old one goes away.
    create_before_destroy = true
  }
}

resource "aws_route53_record" "certificate_validation" {
  # Iterating the count list rather than indexing [0] keeps this valid when the
  # certificate is not created at all.
  for_each = {
    for option in flatten([for certificate in aws_acm_certificate.edge : tolist(certificate.domain_validation_options)]) :
    option.domain_name => option
  }

  zone_id = local.hosted_zone_id
  name    = each.value.resource_record_name
  type    = each.value.resource_record_type
  records = [each.value.resource_record_value]
  ttl     = 60

  # Apex and www resolve to the same validation record; without this the second
  # one fails with "record already exists".
  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "edge" {
  count = local.custom_domain_enabled ? 1 : 0

  provider = aws.us_east_1

  certificate_arn         = aws_acm_certificate.edge[0].arn
  validation_record_fqdns = [for record in aws_route53_record.certificate_validation : record.fqdn]

  timeouts {
    # On a zone that has not been delegated at the registrar yet, validation
    # never completes. Fail in 30 minutes with a clear timeout instead of
    # hanging for the provider's default hour.
    create = "30m"
  }
}
