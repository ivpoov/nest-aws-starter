data "aws_region" "current" {}

locals {
  # NAT can only serve a private tier, and never more gateways than there are
  # zones to put them in. Clamping here means the caller can pass the profile's
  # nat_gateway_count unconditionally.
  nat_gateway_count = var.private_subnets_enabled ? min(var.nat_gateway_count, length(var.azs)) : 0

  # Subnet layout, as /24s out of the VPC block. Public subnets take indexes
  # 0..n-1 and private subnets 10..10+n-1, leaving a visible gap so a third tier
  # (isolated, index 20+) can be added later without renumbering — and so a /24
  # tells you which tier it is at a glance.
  public_subnet_offset  = 0
  private_subnet_offset = 10
}

# ---------------------------------------------------------------------------
# VPC
# ---------------------------------------------------------------------------

resource "aws_vpc" "this" {
  cidr_block = var.vpc_cidr

  # Both are required for the private DNS names of RDS, ElastiCache and any
  # interface endpoints to resolve inside the VPC.
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = var.names.vpc
  }
}

# Every VPC ships with a default security group that allows all traffic between
# anything attached to it. Nothing here uses it, but leaving it permissive is a
# standing finding in every audit — this revokes all of its rules.
resource "aws_default_security_group" "this" {
  vpc_id = aws_vpc.this.id

  tags = {
    Name = "${var.names.vpc}-default-revoked"
  }
}

# ---------------------------------------------------------------------------
# Public tier — internet-facing. The ALB lives here; in the demo profile the
# API task does too, because there is no NAT to give a private subnet egress.
# ---------------------------------------------------------------------------

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id

  tags = {
    Name = var.names.internet_gateway
  }
}

resource "aws_subnet" "public" {
  count = length(var.azs)

  vpc_id            = aws_vpc.this.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, local.public_subnet_offset + count.index)
  availability_zone = var.azs[count.index]

  # Fargate tasks in the demo profile run here and need a public IP to reach
  # ECR; the subnet default is what the ECS service inherits when it is told to
  # assign one. Reachability is still governed entirely by security groups —
  # nothing but the ALB accepts traffic from the internet.
  map_public_ip_on_launch = true

  tags = {
    Name = "${var.names.public_subnet}-${var.azs[count.index]}"
    Tier = "public"
  }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id

  tags = {
    Name = "${var.names.public_subnet}-rt"
  }
}

resource "aws_route" "public_internet" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.this.id
}

resource "aws_route_table_association" "public" {
  count = length(aws_subnet.public)

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# ---------------------------------------------------------------------------
# Private tier — created by the production profile only.
#
# With nat_gateway_count = 0 (the default, including in production) these
# subnets have no default route at all: workloads in them reach the VPC and the
# S3 gateway endpoint and nothing else. That is free, and it is the right
# starting point — turn NAT on deliberately, knowing the bill.
# ---------------------------------------------------------------------------

resource "aws_subnet" "private" {
  count = var.private_subnets_enabled ? length(var.azs) : 0

  vpc_id            = aws_vpc.this.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, local.private_subnet_offset + count.index)
  availability_zone = var.azs[count.index]

  map_public_ip_on_launch = false

  tags = {
    Name = "${var.names.private_subnet}-${var.azs[count.index]}"
    Tier = "private"
  }
}

# One route table per AZ rather than one shared: with a NAT gateway per zone,
# each zone must route through its own, or a zone failure takes down the egress
# of the zones that were borrowing it — and cross-AZ NAT traffic is billed as
# inter-AZ transfer on top.
resource "aws_route_table" "private" {
  count = length(aws_subnet.private)

  vpc_id = aws_vpc.this.id

  tags = {
    Name = "${var.names.private_subnet}-rt-${var.azs[count.index]}"
  }
}

resource "aws_route_table_association" "private" {
  count = length(aws_subnet.private)

  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}

# ---------------------------------------------------------------------------
# NAT gateways — the expensive part, and off unless asked for.
#
# ~$32/month per gateway (~$0.045/hour) before any data processing charge, in
# every region, whether or not a single packet crosses it. The demo profile can
# never reach this code: it creates no private subnets, so local.nat_gateway_count
# clamps to 0 regardless of what is passed in.
# ---------------------------------------------------------------------------

resource "aws_eip" "nat" {
  count = local.nat_gateway_count

  domain = "vpc"

  tags = {
    Name = "${var.names.nat_gateway}-${var.azs[count.index]}"
  }

  depends_on = [aws_internet_gateway.this]
}

resource "aws_nat_gateway" "this" {
  count = local.nat_gateway_count

  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  tags = {
    Name = "${var.names.nat_gateway}-${var.azs[count.index]}"
  }

  depends_on = [aws_internet_gateway.this]
}

# element() wraps, so fewer gateways than zones still leaves every private
# subnet with egress — the zones just share, which is exactly the trade-off
# nat_gateway_count exists to express.
resource "aws_route" "private_nat" {
  count = local.nat_gateway_count > 0 ? length(aws_route_table.private) : 0

  route_table_id         = aws_route_table.private[count.index].id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = element(aws_nat_gateway.this[*].id, count.index)
}
