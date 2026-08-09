# ---------------------------------------------------------------------------
# Uploads bucket
#
# User-uploaded objects. The browser never talks to this bucket with long-lived
# credentials: the API signs a short-lived PUT (S3ProviderService.
# getPresignedUploadUrl) and the browser uploads straight to S3. That is why the
# bucket is fully private and still needs a CORS configuration — the signature
# authorizes the request, CORS is only what stops the browser refusing to make
# it.
# ---------------------------------------------------------------------------

resource "aws_s3_bucket" "uploads" {
  bucket = var.uploads_bucket_name

  # Demo only. A bucket with objects in it refuses to delete, which turns
  # `terraform destroy` into a manual console cleanup and leaves people paying
  # for a stack they thought they had torn down. Production keeps the guard.
  force_destroy = var.uploads_bucket_force_destroy
}

resource "aws_s3_bucket_versioning" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  # Uploads are user data: an overwrite or a bad delete is recoverable only if
  # the previous version is still there. Lifecycle below caps what that costs.
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  rule {
    apply_server_side_encryption_by_default {
      # SSE-S3, matching the state bucket: no per-request KMS charge and no key
      # to lose. Switch to aws:kms with your own key if compliance requires it.
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  rule {
    object_ownership = "BucketOwnerEnforced" # ACLs disabled entirely
  }
}

# CORS is what the browser preflights a presigned PUT against. Without it the
# upload fails in the browser with an opaque network error while the very same
# signed URL works fine from curl — a confusing afternoon that this block exists
# to prevent.
resource "aws_s3_bucket_cors_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  cors_rule {
    # PUT for presigned uploads, GET/HEAD for presigned downloads and the
    # size/content-type probe (S3ProviderService.headObject).
    allowed_methods = ["GET", "HEAD", "PUT"]
    allowed_origins = var.uploads_cors_allowed_origins

    # The signed PUT carries Content-Type and the x-amz-* signature headers, and
    # the browser names every one of them in Access-Control-Request-Headers.
    # Enumerating them here just breaks the upload the next time the SDK adds
    # one; this list does not widen who may write, only which headers the
    # browser is willing to send on an already-authorized request.
    allowed_headers = ["*"]

    # ETag is the only response header a client needs back from an upload.
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  rule {
    id     = "expire-noncurrent-versions"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days = var.uploads_noncurrent_version_retention_days
    }
  }

  rule {
    id     = "abort-incomplete-uploads"
    status = "Enabled"

    filter {}

    # Abandoned multipart parts are invisible in the console and billed anyway.
    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }

  depends_on = [aws_s3_bucket_versioning.uploads]
}

data "aws_iam_policy_document" "uploads" {
  statement {
    sid    = "DenyInsecureTransport"
    effect = "Deny"

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    actions = ["s3:*"]

    resources = [
      aws_s3_bucket.uploads.arn,
      "${aws_s3_bucket.uploads.arn}/*",
    ]

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  policy = data.aws_iam_policy_document.uploads.json

  # Attaching a policy before public access is blocked briefly widens the
  # bucket; order it explicitly.
  depends_on = [aws_s3_bucket_public_access_block.uploads]
}
