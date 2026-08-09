# ---------------------------------------------------------------------------
# The chain
#
#   internet ──443/80──▶ ALB ──api port──▶ API task ──5432──▶ database
#                                                   ╰──6379──▶ cache
#
# Exactly one group accepts a CIDR from the internet: the ALB's. Every rule
# between tiers references the source security group instead of a CIDR block,
# so the rules keep meaning what they say when subnets are renumbered, when the
# private tier appears, or when a task lands in a different AZ. A CIDR-based
# rule would also happily admit anything else that happens to sit in that range.
#
# Rules are separate resources (aws_vpc_security_group_*_rule) rather than
# inline blocks: inline rules are authoritative for the whole group, so two
# tiers referencing each other becomes a dependency cycle, and any rule added
# out of band is silently reverted rather than reported.
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# ALB — the only thing on the public internet
# ---------------------------------------------------------------------------

resource "aws_security_group" "alb" {
  name        = var.security_group_names.alb
  description = "Public entry point: accepts HTTP/HTTPS from the internet and forwards to the API task."
  vpc_id      = aws_vpc.this.id

  tags = {
    Name = var.security_group_names.alb
    Tier = "alb"
  }
}

# Port 80 exists only to be redirected to 443 by the listener rule. It is not a
# way in: nothing is served over it.
resource "aws_vpc_security_group_ingress_rule" "alb_http_ipv4" {
  security_group_id = aws_security_group.alb.id
  description       = "HTTP from anywhere, redirected to HTTPS by the listener"
  ip_protocol       = "tcp"
  from_port         = 80
  to_port           = 80
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_vpc_security_group_ingress_rule" "alb_http_ipv6" {
  security_group_id = aws_security_group.alb.id
  description       = "HTTP from anywhere (IPv6), redirected to HTTPS by the listener"
  ip_protocol       = "tcp"
  from_port         = 80
  to_port           = 80
  cidr_ipv6         = "::/0"
}

resource "aws_vpc_security_group_ingress_rule" "alb_https_ipv4" {
  security_group_id = aws_security_group.alb.id
  description       = "HTTPS from anywhere"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_vpc_security_group_ingress_rule" "alb_https_ipv6" {
  security_group_id = aws_security_group.alb.id
  description       = "HTTPS from anywhere (IPv6)"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
  cidr_ipv6         = "::/0"
}

# The ALB talks to exactly one thing. Health checks use the same port, so no
# second rule is needed.
resource "aws_vpc_security_group_egress_rule" "alb_to_api" {
  security_group_id            = aws_security_group.alb.id
  description                  = "Forward requests and health checks to the API task"
  ip_protocol                  = "tcp"
  from_port                    = var.api_container_port
  to_port                      = var.api_container_port
  referenced_security_group_id = aws_security_group.api.id
}

# ---------------------------------------------------------------------------
# API task — reachable only from the ALB
# ---------------------------------------------------------------------------

resource "aws_security_group" "api" {
  name        = var.security_group_names.api
  description = "API tasks: ingress from the ALB only, egress to AWS APIs and the data tier."
  vpc_id      = aws_vpc.this.id

  tags = {
    Name = var.security_group_names.api
    Tier = "application"
  }
}

resource "aws_vpc_security_group_ingress_rule" "api_from_alb" {
  security_group_id            = aws_security_group.api.id
  description                  = "Application traffic from the load balancer"
  ip_protocol                  = "tcp"
  from_port                    = var.api_container_port
  to_port                      = var.api_container_port
  referenced_security_group_id = aws_security_group.alb.id
}

# Egress is enumerated rather than left wide open. The default "all traffic to
# 0.0.0.0/0" that every tutorial leaves in place is what turns a compromised
# dependency into a data exfiltration channel on an arbitrary port. This set is
# what a Fargate task actually needs; widen it deliberately if the app calls
# something on a non-443 port.
resource "aws_vpc_security_group_egress_rule" "api_https" {
  security_group_id = aws_security_group.api.id
  description       = "HTTPS to AWS APIs (ECR, S3, Secrets Manager, CloudWatch, SES, SQS) and third-party APIs"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_vpc_security_group_egress_rule" "api_dns_udp" {
  security_group_id = aws_security_group.api.id
  description       = "DNS to the VPC resolver"
  ip_protocol       = "udp"
  from_port         = 53
  to_port           = 53
  cidr_ipv4         = aws_vpc.this.cidr_block
}

# TCP as well as UDP: responses larger than 512 bytes fall back to TCP, which is
# routine for the multi-record answers AWS endpoints return.
resource "aws_vpc_security_group_egress_rule" "api_dns_tcp" {
  security_group_id = aws_security_group.api.id
  description       = "DNS to the VPC resolver (TCP fallback for large answers)"
  ip_protocol       = "tcp"
  from_port         = 53
  to_port           = 53
  cidr_ipv4         = aws_vpc.this.cidr_block
}

# Amazon Time Sync on the link-local address. Clock drift breaks SigV4 request
# signing, which surfaces as unexplained AWS API auth failures hours later.
resource "aws_vpc_security_group_egress_rule" "api_ntp" {
  security_group_id = aws_security_group.api.id
  description       = "NTP to the Amazon Time Sync service"
  ip_protocol       = "udp"
  from_port         = 123
  to_port           = 123
  cidr_ipv4         = "169.254.169.123/32"
}

resource "aws_vpc_security_group_egress_rule" "api_to_database" {
  security_group_id            = aws_security_group.api.id
  description                  = "PostgreSQL to the database tier"
  ip_protocol                  = "tcp"
  from_port                    = var.database_port
  to_port                      = var.database_port
  referenced_security_group_id = aws_security_group.database.id
}

resource "aws_vpc_security_group_egress_rule" "api_to_cache" {
  security_group_id            = aws_security_group.api.id
  description                  = "Redis to the cache tier"
  ip_protocol                  = "tcp"
  from_port                    = var.cache_port
  to_port                      = var.cache_port
  referenced_security_group_id = aws_security_group.cache.id
}

# ---------------------------------------------------------------------------
# Data tier — reachable only from the API task, and it initiates nothing
#
# Both groups deliberately have no egress rules at all. A managed database and a
# managed cache answer connections; they never open them. AWS handles backups,
# patching and replication outside the ENI, so an empty egress set costs nothing
# and removes the tier as an exfiltration path.
# ---------------------------------------------------------------------------

resource "aws_security_group" "database" {
  name        = var.security_group_names.database
  description = "Database: ingress from the API tasks only, no egress."
  vpc_id      = aws_vpc.this.id

  tags = {
    Name = var.security_group_names.database
    Tier = "data"
  }
}

resource "aws_vpc_security_group_ingress_rule" "database_from_api" {
  security_group_id            = aws_security_group.database.id
  description                  = "PostgreSQL from the API tasks"
  ip_protocol                  = "tcp"
  from_port                    = var.database_port
  to_port                      = var.database_port
  referenced_security_group_id = aws_security_group.api.id
}

resource "aws_security_group" "cache" {
  name        = var.security_group_names.cache
  description = "Cache: ingress from the API tasks only, no egress."
  vpc_id      = aws_vpc.this.id

  tags = {
    Name = var.security_group_names.cache
    Tier = "data"
  }
}

resource "aws_vpc_security_group_ingress_rule" "cache_from_api" {
  security_group_id            = aws_security_group.cache.id
  description                  = "Redis from the API tasks"
  ip_protocol                  = "tcp"
  from_port                    = var.cache_port
  to_port                      = var.cache_port
  referenced_security_group_id = aws_security_group.api.id
}
