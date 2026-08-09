# ---------------------------------------------------------------------------
# One distribution per static site.
#
# Origin Access Control, not the older Origin Access Identity. OAI is legacy,
# signs with a fixed identity, and does not work with SSE-KMS or newer regions;
# AWS has recommended OAC over it since 2022. Half the CloudFront + S3 material
# on the internet still shows OAI.
#
# CACHING — the split below is the whole point:
#
#   /assets/*   content-hashed by Vite, therefore immutable. Cached long
#               (Managed-CachingOptimized).
#   everything  index.html and every client-side route. Served no-cache
#   else        (Managed-CachingDisabled).
#
# Getting that backwards is the classic single-page-app deploy failure: the
# shell is cached at the edge, the next deploy deletes the asset hashes it
# points at, and returning users get a white screen until the TTL expires. The
# default behaviour is the no-cache one on purpose — a new build layout that
# emits assets somewhere unexpected then degrades to "slower than it could be"
# rather than "broken for a day".
# ---------------------------------------------------------------------------

resource "aws_cloudfront_origin_access_control" "site" {
  for_each = var.sites

  name                              = each.value.bucket_name
  description                       = "OAC for ${each.value.bucket_name}"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "site" {
  for_each = var.sites

  enabled             = true
  is_ipv6_enabled     = true
  comment             = trimspace("${var.comment_prefix} ${each.value.comment}")
  default_root_object = "index.html"
  price_class         = var.price_class
  aliases             = local.custom_domain_enabled ? each.value.hostnames : []
  web_acl_id          = var.web_acl_arn

  origin {
    origin_id                = "s3-${each.key}"
    domain_name              = aws_s3_bucket.site[each.key].bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.site[each.key].id
  }

  default_cache_behavior {
    target_origin_id       = "s3-${each.key}"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]

    # Compression is the CDN's job — the origin stores one plain copy and
    # CloudFront negotiates gzip/brotli per viewer.
    compress = true

    cache_policy_id            = data.aws_cloudfront_cache_policy.caching_disabled.id
    response_headers_policy_id = data.aws_cloudfront_response_headers_policy.security_headers.id
  }

  dynamic "ordered_cache_behavior" {
    for_each = var.immutable_path_patterns

    content {
      path_pattern           = ordered_cache_behavior.value
      target_origin_id       = "s3-${each.key}"
      viewer_protocol_policy = "redirect-to-https"
      allowed_methods        = ["GET", "HEAD", "OPTIONS"]
      cached_methods         = ["GET", "HEAD"]
      compress               = true

      cache_policy_id            = data.aws_cloudfront_cache_policy.caching_optimized.id
      response_headers_policy_id = data.aws_cloudfront_response_headers_policy.security_headers.id
    }
  }

  # Client-side routing: /orders/42 is not an object in the bucket. A private
  # bucket answers a missing key with 403 (not 404 — that needs s3:ListBucket,
  # which the policy deliberately does not grant), so both have to be mapped.
  #
  # The response code is 200, not the original status: the router renders the
  # route, and a 404 body would make the browser and every crawler treat a
  # working page as missing. Real "not found" pages are the SPA's own business.
  dynamic "custom_error_response" {
    for_each = toset([403, 404])

    content {
      error_code         = custom_error_response.value
      response_code      = 200
      response_page_path = "/index.html"

      # Never cache the rewrite: during a deploy a genuinely-missing asset would
      # otherwise be pinned to the shell HTML at the edge.
      error_caching_min_ttl = 0
    }
  }

  dynamic "logging_config" {
    for_each = var.logging_enabled && var.log_bucket_domain_name != null ? [1] : []

    content {
      bucket          = var.log_bucket_domain_name
      prefix          = "cloudfront/${each.key}/"
      include_cookies = false
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    # No domain configured: the free *.cloudfront.net certificate. Still HTTPS,
    # still HTTP/2 and HTTP/3, just not your hostname.
    cloudfront_default_certificate = !local.custom_domain_enabled

    acm_certificate_arn      = local.certificate_arn
    ssl_support_method       = local.custom_domain_enabled ? "sni-only" : null
    minimum_protocol_version = local.custom_domain_enabled ? "TLSv1.2_2021" : null
  }
}
