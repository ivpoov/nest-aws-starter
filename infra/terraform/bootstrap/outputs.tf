output "state_bucket_name" {
  description = "Name of the remote state bucket. Feed this to the root stack as backend config."
  value       = aws_s3_bucket.state.id
}

output "state_bucket_arn" {
  description = "ARN of the remote state bucket."
  value       = aws_s3_bucket.state.arn
}

output "backend_config" {
  description = "Ready-to-paste contents of infra/terraform/backend.hcl for the root stack."
  value       = <<-EOT
    bucket       = "${aws_s3_bucket.state.id}"
    key          = "<environment>/terraform.tfstate"
    region       = "${var.aws_region}"
    encrypt      = true
    use_lockfile = true
  EOT
}
