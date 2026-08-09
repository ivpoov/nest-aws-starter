# ---------------------------------------------------------------------------
# Shared access-log bucket
#
# This is the bucket local.names.logs_bucket is reserved for. The production
# profile sets access_logs_enabled, and that single key creates the bucket and
# turns on both of its writers:
#
#   cloudfront/<site>/  — CloudFront standard logs for the two SPA
#                         distributions, via the edge module's
#                         log_bucket_domain_name input;
#   alb/                — Application Load Balancer access logs for the API,
#                         via the compute module's access_logs input.
#
# The two arrive by completely different mechanisms, which is why this file
# carries both an ACL and a bucket policy — see below.
#
# It lives here rather than in the edge or compute modules because access logs
# are not either one's concern, they belong in the same bucket under their own
# prefixes, and neither module should own storage the other writes to.
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

  # Prefix the load balancer delivers under. ELB appends
  # AWSLogs/<account-id>/elasticloadbalancing/<region>/<date>/ beneath it, so the
  # bucket policy below has to grant on exactly that shape and not on the bucket
  # as a whole.
  alb_access_logs_prefix = "alb"

  alb_access_logs_object_arn = var.access_logs_bucket_enabled ? "${aws_s3_bucket.access_logs[0].arn}/${local.alb_access_logs_prefix}/AWSLogs/${data.aws_caller_identity.current.account_id}/*" : null

  # The one service principal that can deliver ALB logs in a Region launched
  # from August 2022 onward. Older Regions deliver as a per-Region ELB account
  # instead — see var.alb_log_delivery_uses_regional_account.
  alb_log_delivery_service_principal = "logdelivery.elasticloadbalancing.amazonaws.com"
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

    # CloudFront and the ALB both deliver many small gzipped objects. An
    # incomplete multipart upload here would be invisible and billed
    # indefinitely.
    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

# ---------------------------------------------------------------------------
# Bucket policy — Application Load Balancer log delivery
#
# CloudFront needs no policy at all: it delivers with an ACL grant, which is the
# grant above. The ALB is the opposite — it delivers as an AWS-owned identity
# and writes nothing unless a bucket policy names that identity. Which identity
# depends on the Region, and this is the part that is easy to get wrong:
#
#   Regions launched BEFORE August 2022 (us-east-1, eu-west-1, ap-southeast-2,
#   … i.e. almost certainly yours) deliver as a per-Region ELB *account*, whose
#   id data.aws_elb_service_account resolves. That data source is a lookup table
#   inside the provider, and it has no entry for the newer Regions.
#
#   Regions launched from August 2022 onward (eu-central-2, me-central-1,
#   il-central-1, ap-south-2, ca-west-1, …) deliver as the service principal
#   below, with an s3:x-amz-acl condition.
#
# So the service-principal statement is unconditional — it costs nothing in an
# older Region, where that principal never writes — and the regional-account
# statement is behind var.alb_log_delivery_uses_regional_account, which also
# gates the data source that would otherwise fail to resolve in a new Region.
#
# NOTE: none of this can be verified without an apply. `terraform validate`
# checks the shape of the document, not whether ELB accepts it; the load
# balancer only reports the answer when it is created, and it reports it as
# "Access Denied for bucket" with no further detail.
# ---------------------------------------------------------------------------

data "aws_elb_service_account" "current" {
  count = var.access_logs_bucket_enabled && var.alb_log_delivery_uses_regional_account ? 1 : 0
}

data "aws_iam_policy_document" "access_logs" {
  count = var.access_logs_bucket_enabled ? 1 : 0

  dynamic "statement" {
    for_each = var.alb_log_delivery_uses_regional_account ? [1] : []

    content {
      sid     = "AlbLogDeliveryRegionalAccount"
      effect  = "Allow"
      actions = ["s3:PutObject"]

      principals {
        type        = "AWS"
        identifiers = [data.aws_elb_service_account.current[0].arn]
      }

      resources = [local.alb_access_logs_object_arn]
    }
  }

  statement {
    sid     = "AlbLogDeliveryServicePrincipal"
    effect  = "Allow"
    actions = ["s3:PutObject"]

    principals {
      type        = "Service"
      identifiers = [local.alb_log_delivery_service_principal]
    }

    resources = [local.alb_access_logs_object_arn]

    # Required by AWS on this path: the delivered object must hand ownership to
    # the bucket's account. Without it the write is refused.
    condition {
      test     = "StringEquals"
      variable = "s3:x-amz-acl"
      values   = ["bucket-owner-full-control"]
    }
  }
}

resource "aws_s3_bucket_policy" "access_logs" {
  count = var.access_logs_bucket_enabled ? 1 : 0

  bucket = aws_s3_bucket.access_logs[0].id
  policy = data.aws_iam_policy_document.access_logs[0].json

  # The public access block sets block_public_policy. Neither statement above is
  # public — both name an identity — but attaching the policy after the block
  # exists keeps the two from racing on a fresh apply.
  depends_on = [aws_s3_bucket_public_access_block.access_logs]
}
