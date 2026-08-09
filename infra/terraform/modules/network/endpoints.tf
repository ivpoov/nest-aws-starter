# ---------------------------------------------------------------------------
# S3 gateway endpoint — always on, because it is free
#
# A gateway endpoint is a route table entry, not an ENI: no hourly charge, no
# per-GB processing. It keeps S3 traffic (asset uploads, ALB/CloudFront logs,
# ECR image layers, which live in S3) off the internet path entirely. In a
# private subnet that means those calls work with no NAT gateway at all, and in
# a public subnet it still saves the data transfer.
#
# There is deliberately no DynamoDB gateway endpoint: this stack has no
# DynamoDB table, not even for Terraform state locking.
# ---------------------------------------------------------------------------

resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.this.id
  service_name      = "com.amazonaws.${data.aws_region.current.region}.s3"
  vpc_endpoint_type = "Gateway"

  # Every route table, both tiers — the endpoint only applies to subnets whose
  # route table is associated with it.
  route_table_ids = concat([aws_route_table.public.id], aws_route_table.private[*].id)

  tags = {
    Name = "${var.names.vpc}-s3"
  }
}

# ---------------------------------------------------------------------------
# Interface endpoints — opt-in, and never in the demo profile
#
# Unlike the gateway endpoint above, an interface endpoint is a real ENI in
# every subnet it is placed in: roughly $0.01/hour each, so about $7/month per
# endpoint per AZ, plus per-GB processing. The set people reach for by reflex —
# ecr.api, ecr.dkr, logs, secretsmanager, ssm — across three AZs costs more per
# month than the NAT gateway it was supposed to replace.
#
# They earn their place for a private-subnet workload with steady AWS API
# traffic, where they remove the NAT data-processing charge and keep the calls
# off the public internet. That is a decision with a number attached, so it is
# an explicit input rather than something a profile flips on quietly. Service
# names go in short form, e.g.:
#
#   interface_endpoints = ["ecr.api", "ecr.dkr", "logs", "secretsmanager"]
# ---------------------------------------------------------------------------

resource "aws_security_group" "vpc_endpoints" {
  count = length(var.interface_endpoints) > 0 ? 1 : 0

  name        = var.security_group_names.vpc_endpoints
  description = "Interface VPC endpoints: HTTPS from the API tasks only."
  vpc_id      = aws_vpc.this.id

  tags = {
    Name = var.security_group_names.vpc_endpoints
    Tier = "endpoints"
  }
}

resource "aws_vpc_security_group_ingress_rule" "vpc_endpoints_from_api" {
  count = length(aws_security_group.vpc_endpoints)

  security_group_id            = aws_security_group.vpc_endpoints[count.index].id
  description                  = "HTTPS from the API tasks"
  ip_protocol                  = "tcp"
  from_port                    = 443
  to_port                      = 443
  referenced_security_group_id = aws_security_group.api.id
}

resource "aws_vpc_endpoint" "interface" {
  for_each = toset(var.interface_endpoints)

  vpc_id            = aws_vpc.this.id
  service_name      = "com.amazonaws.${data.aws_region.current.region}.${each.key}"
  vpc_endpoint_type = "Interface"

  subnet_ids         = aws_subnet.private[*].id
  security_group_ids = aws_security_group.vpc_endpoints[*].id

  # Without this the SDKs keep resolving the public endpoint and the ENIs are
  # billed for nothing.
  private_dns_enabled = true

  tags = {
    Name = "${var.names.vpc}-${replace(each.key, ".", "-")}"
  }

  lifecycle {
    precondition {
      condition     = var.private_subnets_enabled
      error_message = "interface_endpoints requires the private subnet tier: interface endpoints are placed in private subnets."
    }
  }
}
