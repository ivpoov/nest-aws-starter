terraform {
  # Partial backend configuration on purpose: the bucket name embeds an AWS
  # account id and this repository is public, so the concrete values live in a
  # gitignored backend.hcl (see backend.hcl.example).
  #
  #   terraform init -backend-config=backend.hcl
  #
  # LOCKING: `use_lockfile` is set in backend.hcl and uses Terraform's native S3
  # locking (a `.tflock` object beside the state file), added in 1.10. There is
  # no DynamoDB table anywhere in this repository — every guide older than 2025
  # tells you to create one, and that advice is now obsolete.
  backend "s3" {}
}
