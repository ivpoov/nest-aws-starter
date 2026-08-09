# ---------------------------------------------------------------------------
# Optional: CloudFront in front of the ALB. OFF by default.
#
# What turning it on buys you:
#   - HTTPS on the API without owning a domain. An ALB's own
#     *.elb.amazonaws.com hostname cannot have a valid certificate, so without
#     a distribution (or a custom domain plus an ACM certificate on the
#     listener) the API is plain HTTP — and a browser on an HTTPS frontend will
#     refuse to call it.
#   - The frontends and the API share an edge network, so TLS terminates close
#     to the user and connections to the origin are already warm.
#   - The ALB can then be locked down to CloudFront's managed prefix list,
#     which takes it off the public internet entirely.
#
# What it costs you:
#   - Another hop, and CloudFront request charges on every API call, for
#     responses that are almost entirely uncacheable.
#   - The API stops seeing client IPs directly. Everything arrives from a
#     CloudFront edge, so rate limiting and audit logging have to read
#     X-Forwarded-For and trust exactly one proxy hop — get that wrong and the
#     limiter is either useless or trivially forgeable.
#   - Locking the ALB to the prefix list is a separate change in the module
#     that owns the security group. Without it, this adds a hop and leaves the
#     ALB just as reachable as before.
#
# Off by default because the demo posture — frontends on CloudFront, API on the
# ALB — is the cheaper half of that trade, and because the second bullet is a
# security regression if it is switched on without being noticed.
# ---------------------------------------------------------------------------

data "aws_cloudfront_origin_request_policy" "all_viewer_except_host" {
  # Forwards every header, cookie and query string except Host. Host is the one
  # to leave alone: the ALB routes on it, and passing the viewer's Host through
  # breaks host-based listener rules.
  name = "Managed-AllViewerExceptHostHeader"
}

resource "aws_cloudfront_distribution" "api" {
  count = var.api_distribution_enabled ? 1 : 0

  enabled         = true
  is_ipv6_enabled = true
  comment         = trimspace("${var.comment_prefix} (api)")
  price_class     = var.price_class
  aliases         = local.custom_domain_enabled ? var.api_hostnames : []
  web_acl_id      = var.web_acl_arn

  origin {
    origin_id   = "alb"
    domain_name = var.alb_dns_name

    custom_origin_config {
      http_port  = 80
      https_port = 443

      # http-only by default: the ALB's own hostname has no certificate to
      # validate. Switch to https-only once the listener carries an ACM
      # certificate for a name CloudFront can verify.
      origin_protocol_policy = var.alb_origin_protocol_policy
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    target_origin_id       = "alb"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods         = ["GET", "HEAD"]

    # Compression is the CDN's job — the API ships JSON uncompressed and lets
    # the edge negotiate the encoding.
    compress = true

    # Caching off, deliberately: this is an authenticated JSON API, and a shared
    # cache in front of one is how a user gets served another user's response.
    # Per-endpoint caching belongs in a behaviour of its own, added knowingly.
    cache_policy_id            = data.aws_cloudfront_cache_policy.caching_disabled.id
    origin_request_policy_id   = data.aws_cloudfront_origin_request_policy.all_viewer_except_host.id
    response_headers_policy_id = data.aws_cloudfront_response_headers_policy.security_headers.id
  }

  dynamic "logging_config" {
    for_each = var.logging_enabled && var.log_bucket_domain_name != null ? [1] : []

    content {
      bucket          = var.log_bucket_domain_name
      prefix          = "cloudfront/api/"
      include_cookies = false
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = !local.custom_domain_enabled

    acm_certificate_arn      = local.certificate_arn
    ssl_support_method       = local.custom_domain_enabled ? "sni-only" : null
    minimum_protocol_version = local.custom_domain_enabled ? "TLSv1.2_2021" : null
  }
}

resource "aws_route53_record" "api_ipv4" {
  for_each = local.custom_domain_enabled && var.api_distribution_enabled ? toset(var.api_hostnames) : toset([])

  zone_id = local.hosted_zone_id
  name    = each.value
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.api[0].domain_name
    zone_id                = local.cloudfront_hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "api_ipv6" {
  for_each = local.custom_domain_enabled && var.api_distribution_enabled ? toset(var.api_hostnames) : toset([])

  zone_id = local.hosted_zone_id
  name    = each.value
  type    = "AAAA"

  alias {
    name                   = aws_cloudfront_distribution.api[0].domain_name
    zone_id                = local.cloudfront_hosted_zone_id
    evaluate_target_health = false
  }
}
