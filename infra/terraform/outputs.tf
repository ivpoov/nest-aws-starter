# Stack-wide outputs: the identity the stack resolved to, and the inputs every
# module was handed.
#
# Nothing here belongs to a module. Each module's own outputs are declared
# beside the `module` block that creates it — network.tf, datastores.tf,
# services.tf, compute.tf, edge.tf, observability.tf, cicd.tf — so an output and
# its source stay in the same file. What is left is this file: the account,
# region and partition the provider resolved, the name prefix everything derives
# from, and the two maps a reader most often wants to see before applying.
#
# cost_profile_settings and resource_names are the useful pair. Diffing
# cost_profile_settings between `demo` and `production` is how you audit the
# whole cost surface without reading locals.tf, and resource_names is the
# complete list of what an apply will create, by name, before it exists.

output "account_id" {
  description = "AWS account the stack is targeting."
  value       = local.account_id
}

output "region" {
  description = "Region the stack is targeting."
  value       = local.region
}

output "partition" {
  description = "AWS partition (aws, aws-us-gov, aws-cn). Build ARNs from this rather than hardcoding \"aws\"."
  value       = local.partition
}

output "name_prefix" {
  description = "Prefix every resource name derives from."
  value       = local.name_prefix
}

output "availability_zones" {
  description = "Availability zones in use, per the selected cost profile."
  value       = local.azs
}

output "cost_profile" {
  description = "Selected cost profile."
  value       = var.cost_profile
}

output "cost_profile_settings" {
  description = "Resolved settings for the selected cost profile. Useful for diffing demo against production before applying."
  value       = local.profile
}

output "resource_names" {
  description = "Every derived resource name. Nothing in this stack is hand-named."
  value       = local.names
}
