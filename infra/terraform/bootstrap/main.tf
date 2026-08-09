provider "aws" {
  region  = var.aws_region
  profile = var.profile

  default_tags {
    tags = local.tags
  }
}

data "aws_caller_identity" "current" {}

locals {
  # S3 bucket names are globally unique across all AWS accounts, so the account
  # id is what keeps this from colliding with someone else's fork of the repo.
  state_bucket_name = "${var.project_name}-tfstate-${data.aws_caller_identity.current.account_id}"

  tags = {
    Project     = var.project_name
    Environment = "shared" # one state bucket serves every environment
    ManagedBy   = "terraform"
    Component   = "tfstate"
  }
}

# ---------------------------------------------------------------------------
# Remote state bucket
#
# NOTE ON LOCKING: there is deliberately no DynamoDB table here. Terraform 1.10
# added native S3 state locking via a `.tflock` object written next to the state
# file (`use_lockfile = true` in the root stack's backend block). Nearly every
# guide written before 2025 tells you to create a DynamoDB table for this — that
# path still works but is now legacy, costs money, and is one more resource to
# forget about. Do not add one.
# ---------------------------------------------------------------------------

resource "aws_s3_bucket" "state" {
  bucket        = local.state_bucket_name
  force_destroy = var.force_destroy
}

resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id

  # Non-negotiable: versioning is the only way back from a truncated or
  # half-written state file.
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    apply_server_side_encryption_by_default {
      # SSE-S3 rather than SSE-KMS: state files hold secrets, but a customer
      # managed key adds per-request charges and a second thing to lose. Swap to
      # aws:kms here if your compliance story requires a key you control.
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "state" {
  bucket = aws_s3_bucket.state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    object_ownership = "BucketOwnerEnforced" # ACLs disabled entirely
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    id     = "expire-noncurrent-state-versions"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days = var.noncurrent_version_retention_days
    }
  }

  rule {
    id     = "abort-incomplete-uploads"
    status = "Enabled"

    filter {}

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }

  depends_on = [aws_s3_bucket_versioning.state]
}

data "aws_iam_policy_document" "state" {
  statement {
    sid    = "DenyInsecureTransport"
    effect = "Deny"

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    actions = ["s3:*"]

    resources = [
      aws_s3_bucket.state.arn,
      "${aws_s3_bucket.state.arn}/*",
    ]

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "state" {
  bucket = aws_s3_bucket.state.id
  policy = data.aws_iam_policy_document.state.json

  # Applying a bucket policy before public access is blocked briefly widens the
  # bucket; order it explicitly.
  depends_on = [aws_s3_bucket_public_access_block.state]
}
