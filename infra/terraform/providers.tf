provider "aws" {
  region  = var.aws_region
  profile = var.profile

  # Every taggable resource in every module inherits these. Cost allocation
  # (billing reports grouped by Project/Environment) and orphan hunting
  # ("what is this and who made it?") both depend on the tags being applied
  # everywhere, which is exactly what nobody remembers to do per resource.
  # Modules should not re-tag with these keys; add only resource-specific tags.
  default_tags {
    tags = local.default_tags
  }
}

# NOTE: CloudFront certificates, and only CloudFront certificates, must live in
# us-east-1 regardless of where the rest of the stack runs. The `us_east_1`
# aliased provider that serves them is declared in edge.tf, next to the edge
# module that is its only consumer — do not add a second one here.
