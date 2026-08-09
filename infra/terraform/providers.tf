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

# NOTE for the edge module: CloudFront certificates, and only CloudFront
# certificates, must live in us-east-1 regardless of where the rest of the
# stack runs. Add a second `provider "aws"` here with `alias = "us_east_1"`
# (same profile, same default_tags) and pass it explicitly when that module
# lands — an aliased provider with no consumers is dead configuration, so it
# is not declared up front.
