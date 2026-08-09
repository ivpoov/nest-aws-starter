# ---------------------------------------------------------------------------
# Shared access-log bucket
#
# This is the bucket local.names.logs_bucket is reserved for. The production
# profile sets cloudfront_logs_enabled, the edge module takes a
# log_bucket_domain_name, and edge.tf passes this module's
# access_logs_bucket_domain_name straight into it — one profile key creates the
# bucket and turns on delivery into it.
#
# It lives here rather than in the edge module because access logs are not a
# CloudFront concern — ALB access logs and S3 server access logs belong in the
# same bucket, under their own prefixes, and none of those modules should own
# storage the others write to.
#
# Created only when the profile actually asks for edge logging. An empty bucket
# that exists "in case" is a resource nobody can explain later.
#
# ACLs ARE ENABLED ON THIS BUCKET, and that is not an oversight. Every other
# bucket in this stack sets BucketOwnerEnforced, which disables ACLs outright.
# CloudFront standard logging predates that setting: it delivers by writing an
# object with an ACL grant to the awslogsdelivery canonical user, and a
# BucketOwnerEnforced bucket rejects the write with no error surfaced anywhere in
# CloudFront. BucketOwnerPreferred is the weakest setting that still works. The
# public access block below is what keeps "ACLs enabled" from meaning "public".
# ---------------------------------------------------------------------------

locals {
  # AWS's global log-delivery account, published in the CloudFront documentation.
  # A canonical user id, not an account id — it is the same value for every AWS
  # customer and carries no information about this account.
  cloudfront_log_delivery_canonical_id = "c4c1ede66af53448b93c283ce9448c4ba468c9432aa01d700d3878632f77d2d0"
}

resource "aws_s3_bucket" "access_logs" {
  count = var.access_logs_bucket_enabled ? 1 : 0

  bucket = var.names.access_logs_bucket

  # A log bucket fills up on its own, so on the disposable profile it has to be
  # emptied on destroy or `terraform destroy` stops on it and the stack outlives
  # the person who thought they had deleted it.
  force_destroy = var.access_logs_force_destroy

  tags = {
    Name = var.names.access_logs_bucket
    Tier = "observability"
  }
}

resource "aws_s3_bucket_public_access_block" "access_logs" {
  count = var.access_logs_bucket_enabled ? 1 : 0

  bucket = aws_s3_bucket.access_logs[0].id

  # block_public_acls stops a *public* ACL grant. The log-delivery grant below
  # names a specific canonical user, so it is unaffected — these four and the
  # delivery grant are not in conflict.
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "access_logs" {
  count = var.access_logs_bucket_enabled ? 1 : 0

  bucket = aws_s3_bucket.access_logs[0].id

  rule {
    object_ownership = "BucketOwnerPreferred"
  }
}

resource "aws_s3_bucket_acl" "access_logs" {
  count = var.access_logs_bucket_enabled ? 1 : 0

  bucket = aws_s3_bucket.access_logs[0].id

  access_control_policy {
    # Restated, not additive: PutBucketAcl replaces the whole ACL, so leaving the
    # owner out here would revoke the owning account's own access.
    owner {
      id = data.aws_canonical_user_id.current[0].id
    }

    grant {
      grantee {
        type = "CanonicalUser"
        id   = data.aws_canonical_user_id.current[0].id
      }
      permission = "FULL_CONTROL"
    }

    grant {
      grantee {
        type = "CanonicalUser"
        id   = local.cloudfront_log_delivery_canonical_id
      }
      permission = "FULL_CONTROL"
    }
  }

  # Setting an ACL on a bucket whose ownership controls have not been relaxed
  # yet fails with AccessControlListNotSupported.
  depends_on = [aws_s3_bucket_ownership_controls.access_logs]
}

resource "aws_s3_bucket_server_side_encryption_configuration" "access_logs" {
  count = var.access_logs_bucket_enabled ? 1 : 0

  bucket = aws_s3_bucket.access_logs[0].id

  rule {
    apply_server_side_encryption_by_default {
      # SSE-S3, and it has to be: CloudFront standard logging cannot deliver to
      # a bucket with SSE-KMS as the default.
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "access_logs" {
  count = var.access_logs_bucket_enabled ? 1 : 0

  bucket = aws_s3_bucket.access_logs[0].id

  rule {
    id     = "expire-access-logs"
    status = "Enabled"

    filter {}

    expiration {
      days = var.access_logs_retention_days
    }

    # CloudFront delivers many small gzipped objects. An incomplete multipart
    # upload here would be invisible and billed indefinitely.
    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}
