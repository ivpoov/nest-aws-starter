data "aws_caller_identity" "current" {}

# Owner of the access-log bucket, needed to restate the owner's own FULL_CONTROL
# grant when the CloudFront log-delivery grant is added: an S3 ACL is replaced
# wholesale, so a policy that names only the delivery account would lock the
# account that created the bucket out of its own objects.
data "aws_canonical_user_id" "current" {
  count = var.access_logs_bucket_enabled ? 1 : 0
}
