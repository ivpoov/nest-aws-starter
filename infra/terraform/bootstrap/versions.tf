# Bootstrap stack — run once per AWS account, before the root stack.
#
# This stack deliberately keeps its state on local disk (terraform.tfstate next
# to these files, gitignored). It is the chicken-and-egg stack: it creates the
# very bucket the root stack stores its state in, so it cannot store its own
# state there. Its state is disposable — everything it manages can be imported
# or recreated from the values in terraform.tfvars.

terraform {
  # Floor is 1.10: that is the first release with native S3 state locking
  # (`use_lockfile`). Pinned to the 1.15 series, which this stack is validated
  # against; bump deliberately, not by accident.
  required_version = "~> 1.15"

  required_providers {
    aws = {
      source = "hashicorp/aws"
      # Pinned to the 6.54 patch series (`~> 6.54.0` allows 6.54.x only). The
      # committed .terraform.lock.hcl pins the exact version and checksums.
      version = "~> 6.54.0"
    }
  }
}
