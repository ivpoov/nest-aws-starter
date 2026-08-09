# AWS-managed policies, looked up by name rather than pasted in as the well-known
# UUIDs every blog post hardcodes. Same behaviour, no magic constants, and they
# keep working in partitions where the ids differ.

data "aws_cloudfront_cache_policy" "caching_optimized" {
  name = "Managed-CachingOptimized"
}

data "aws_cloudfront_cache_policy" "caching_disabled" {
  name = "Managed-CachingDisabled"
}

data "aws_cloudfront_response_headers_policy" "security_headers" {
  name = "Managed-SecurityHeadersPolicy"
}
