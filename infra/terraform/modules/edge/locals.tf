locals {
  # Every hostname the edge has to answer for. Empty when domain_name is null,
  # which is what switches the whole custom-domain path off.
  site_hostnames = sort(distinct(flatten([for name, site in var.sites : site.hostnames])))

  certificate_names = local.site_hostnames

  custom_domain_enabled = var.domain_name != null && length(local.certificate_names) > 0

  # The zone records are written into: an existing one when the caller supplies
  # it, otherwise the one created here.
  hosted_zone_id = var.hosted_zone_id != null ? var.hosted_zone_id : one(aws_route53_zone.primary[*].zone_id)

  # Reading the ARN back off the *validation* resource rather than the
  # certificate is deliberate: it makes every distribution wait until the
  # certificate is actually ISSUED. CloudFront rejects a PENDING_VALIDATION one.
  certificate_arn = one(aws_acm_certificate_validation.edge[*].certificate_arn)

  # Alias records, flattened to one entry per site/hostname pair.
  site_alias_records = merge([
    for name, site in var.sites : {
      for host in site.hostnames : "${name}:${host}" => {
        site = name
        host = host
      }
    }
  ]...)
}
