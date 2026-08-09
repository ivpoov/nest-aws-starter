terraform {
  required_version = "~> 1.15"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.54.0"
    }

    # Declared here rather than in the root stack's versions.tf: nothing outside
    # this module needs a random_* resource, and Terraform installs a provider a
    # child module requires without the root having to restate it. The root never
    # writes a `provider "random"` block, so the implicit empty configuration is
    # the right one.
    #
    # >= 3.6 is the floor: random_bytes, used for the JWT secret, landed there.
    random = {
      source  = "hashicorp/random"
      version = "~> 3.9.0"
    }
  }
}
