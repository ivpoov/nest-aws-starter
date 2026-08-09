# The awslogs driver takes a region as a literal string in the container
# definition, and the run-task command in outputs.tf spells one out too. Read
# from the provider rather than taken as an input, so it cannot disagree with the
# region the resources are actually created in.

data "aws_region" "current" {}
