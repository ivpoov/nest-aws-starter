# One private bucket per static site. Nothing here is public: public access is
# blocked at the bucket level, ACLs are disabled outright, and the only principal
# in the bucket policy is the CloudFront service — scoped down to the one
# distribution that fronts it, so another account's distribution cannot be
# pointed at this bucket.

resource "aws_s3_bucket" "site" {
  for_each = var.sites

  bucket = each.value.bucket_name

  # The demo profile sets this so `terraform destroy` actually destroys.
  # force_destroy removes object versions too, which matters because these
  # buckets are versioned.
  force_destroy = var.force_destroy
}

resource "aws_s3_bucket_public_access_block" "site" {
  for_each = var.sites

  bucket = aws_s3_bucket.site[each.key].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "site" {
  for_each = var.sites

  bucket = aws_s3_bucket.site[each.key].id

  rule {
    object_ownership = "BucketOwnerEnforced" # ACLs disabled; OAC does not need them
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "site" {
  for_each = var.sites

  bucket = aws_s3_bucket.site[each.key].id

  rule {
    apply_server_side_encryption_by_default {
      # SSE-S3 rather than SSE-KMS: OAC can read KMS-encrypted objects, but only
      # with a key policy that grants the distribution, and a per-request KMS
      # charge on every asset is a poor trade for a public web bundle.
      sse_algorithm = "AES256"
    }

    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_versioning" "site" {
  for_each = var.sites

  bucket = aws_s3_bucket.site[each.key].id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "site" {
  for_each = var.sites

  bucket = aws_s3_bucket.site[each.key].id

  # Every deploy replaces the whole bundle, so without this the bucket keeps a
  # copy of every build forever.
  rule {
    id     = "expire-superseded-bundles"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days = var.noncurrent_version_expiration_days
    }
  }

  rule {
    id     = "abort-incomplete-multipart-uploads"
    status = "Enabled"

    filter {}

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }

  depends_on = [aws_s3_bucket_versioning.site]
}

data "aws_iam_policy_document" "site" {
  for_each = var.sites

  statement {
    sid     = "AllowCloudFrontRead"
    effect  = "Allow"
    actions = ["s3:GetObject"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    resources = ["${aws_s3_bucket.site[each.key].arn}/*"]

    # Without this condition the policy would let *any* CloudFront distribution
    # in *any* account read the bucket.
    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.site[each.key].arn]
    }
  }

  statement {
    sid     = "DenyInsecureTransport"
    effect  = "Deny"
    actions = ["s3:*"]

    principals {
      type        = "AWS"
      identifiers = ["*"]
    }

    resources = [
      aws_s3_bucket.site[each.key].arn,
      "${aws_s3_bucket.site[each.key].arn}/*",
    ]

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "site" {
  for_each = var.sites

  bucket = aws_s3_bucket.site[each.key].id
  policy = data.aws_iam_policy_document.site[each.key].json

  depends_on = [aws_s3_bucket_public_access_block.site]
}
