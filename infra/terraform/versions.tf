terraform {
  # Floor is 1.10: that is the first release with native S3 state locking
  # (`use_lockfile`, see backend.tf). Pinned to the 1.15 series, which this
  # stack is validated against; bump deliberately, not by accident.
  required_version = "~> 1.15"

  required_providers {
    aws = {
      source = "hashicorp/aws"
      # Pinned to the 6.54 patch series (`~> 6.54.0` allows 6.54.x only). The
      # committed .terraform.lock.hcl pins the exact version and checksums on
      # top of that; Renovate raises the minor bumps as reviewable PRs.
      version = "~> 6.54.0"
    }
  }
}
