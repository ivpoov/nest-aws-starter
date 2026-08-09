terraform {
  required_version = "~> 1.15"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.54.0"

      # CloudFront reads certificates from us-east-1 and nowhere else, whatever
      # region the rest of the stack lives in. The caller must pass both the
      # default provider and the us-east-1 alias — see the module README.
      configuration_aliases = [aws.us_east_1]
    }
  }
}
