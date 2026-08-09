# The root stack has no resources yet — modules land in PRs 10-16. These
# outputs exist so `terraform plan` on a fresh clone shows you what the inputs
# resolved to before anything is created.

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
