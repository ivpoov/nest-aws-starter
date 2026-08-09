# Identity is read here rather than passed in so the module stays usable on its
# own, and every ARN below is built from the partition rather than a hardcoded
# "aws" — the same code then works in aws-us-gov and aws-cn.

data "aws_caller_identity" "current" {}

data "aws_region" "current" {}

data "aws_partition" "current" {}
