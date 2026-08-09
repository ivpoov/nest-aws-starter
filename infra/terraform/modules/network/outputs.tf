output "vpc_id" {
  description = "Id of the VPC."
  value       = aws_vpc.this.id
}

output "vpc_cidr_block" {
  description = "IPv4 CIDR block of the VPC."
  value       = aws_vpc.this.cidr_block
}

output "availability_zones" {
  description = "Availability zones subnets were created in, in the same order as the subnet id lists."
  value       = var.azs
}

output "public_subnet_ids" {
  description = "Public subnet ids, one per AZ. The ALB spans these."
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "Private subnet ids, one per AZ. Empty unless the private tier is enabled."
  value       = aws_subnet.private[*].id
}

output "workload_subnet_ids" {
  description = "Where ECS tasks, the database and the cache belong: the private subnets when they exist, the public ones otherwise. Consumers should use this rather than picking a tier themselves."
  value       = length(aws_subnet.private) > 0 ? aws_subnet.private[*].id : aws_subnet.public[*].id
}

output "workload_subnets_are_public" {
  description = "True when workloads land in public subnets (no private tier). Consumers use it to decide assign_public_ip on ECS services — a task in a public subnet needs one to reach ECR. It never means the workload is reachable: ingress is governed by the security groups."
  value       = length(aws_subnet.private) == 0
}

output "public_route_table_id" {
  description = "Route table shared by the public subnets."
  value       = aws_route_table.public.id
}

output "private_route_table_ids" {
  description = "Private route tables, one per AZ. Empty unless the private tier is enabled."
  value       = aws_route_table.private[*].id
}

output "nat_gateway_ids" {
  description = "NAT gateway ids. Empty unless NAT was explicitly asked for."
  value       = aws_nat_gateway.this[*].id
}

output "nat_gateway_public_ips" {
  description = "Elastic IPs the NAT gateways egress from — the addresses to hand a third party that allowlists by source IP. Empty unless NAT was explicitly asked for."
  value       = aws_eip.nat[*].public_ip
}

output "alb_security_group_id" {
  description = "Security group for the load balancer. The only group in the stack that accepts traffic from the internet."
  value       = aws_security_group.alb.id
}

output "api_security_group_id" {
  description = "Security group for the API tasks. Accepts traffic from the ALB group only."
  value       = aws_security_group.api.id
}

output "database_security_group_id" {
  description = "Security group for the database. Accepts traffic from the API group only, and initiates none."
  value       = aws_security_group.database.id
}

output "cache_security_group_id" {
  description = "Security group for the cache. Accepts traffic from the API group only, and initiates none."
  value       = aws_security_group.cache.id
}

output "vpc_endpoints_security_group_id" {
  description = "Security group for the interface endpoints, or null when none are configured."
  value       = one(aws_security_group.vpc_endpoints[*].id)
}

output "s3_gateway_endpoint_id" {
  description = "Id of the free S3 gateway endpoint."
  value       = aws_vpc_endpoint.s3.id
}

output "interface_endpoint_ids" {
  description = "Interface endpoint ids keyed by service name. Empty unless interface endpoints were explicitly asked for."
  value       = { for service, endpoint in aws_vpc_endpoint.interface : service => endpoint.id }
}

output "flow_log_group_name" {
  description = "CloudWatch log group flow logs are written to, or null when flow logs are disabled."
  value       = one(aws_cloudwatch_log_group.flow_logs[*].name)
}
