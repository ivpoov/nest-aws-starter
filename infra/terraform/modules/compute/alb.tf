# ---------------------------------------------------------------------------
# Application Load Balancer
#
#   internet ──▶ :443 HTTPS (ACM)  ──▶ target group ──▶ API task :3000
#            ──▶ :80  HTTP         ──▶ 301 to HTTPS
#
# …when api_hostname and hosted_zone_id are both set. Without them there is no
# certificate to terminate TLS with, and :80 forwards in the clear instead. That
# posture is marked loudly below and warned about by a check in the root stack.
# ---------------------------------------------------------------------------

locals {
  # Both halves are required. A hostname with no zone cannot complete DNS
  # validation, so the certificate would hang until the apply times out —
  # failing here instead is the honest outcome.
  custom_domain_enabled = var.api_hostname != null && var.hosted_zone_id != null
}

resource "aws_lb" "api" {
  name               = var.names.alb
  load_balancer_type = "application"
  internal           = false
  security_groups    = [var.alb_security_group_id]

  # Public subnets always, even when the tasks themselves are private. An
  # internet-facing load balancer has to have a route to the internet gateway;
  # where its targets live is a separate question the target group answers.
  subnets = var.public_subnet_ids

  # IPv4 only: the network module's VPC has no IPv6 CIDR, so a dualstack ALB
  # would have nothing to allocate addresses from. (The ALB security group's
  # IPv6 ingress rules are harmless and already in place for the day it does.)
  ip_address_type = "ipv4"

  # Longer than the application's WEBSOCKET_HEARTBEAT_INTERVAL_MS (60 s). The
  # ALB's idle timer counts silence on the connection, and Socket.IO's heartbeat
  # is what breaks that silence; a 60 s timeout against a 60 s heartbeat is a
  # race the socket loses, and the symptom is a client that reconnects every
  # minute for no visible reason.
  idle_timeout = var.alb_idle_timeout_seconds

  # Reject requests carrying headers ELB cannot parse rather than passing them
  # through — the header-smuggling class of request never reaches the app.
  drop_invalid_header_fields = true

  enable_deletion_protection = var.deletion_protection

  # ---------------------------------------------------------------------
  # Access logs
  #
  # The only record of what the load balancer itself saw. The API's own logs
  # start after a request reaches a task, so a 502 from a target that never
  # became healthy, a 4xx the ALB answered on its own, or a TLS negotiation that
  # failed appear in exactly one place — here.
  #
  # Written as a dynamic block rather than `enabled = false` so a disabled
  # profile never has to name a bucket at all: the bucket only exists on the
  # profiles that ask for access logs, and var.access_logs.bucket is null on the
  # others.
  #
  # Delivery is not free and not instant: ELB batches to S3 roughly every five
  # minutes, and the objects are billed as S3 storage plus requests. The
  # lifecycle rule on the bucket is what stops that growing without bound.
  #
  # The bucket policy this needs lives with the bucket, in the observability
  # module — and it cannot be verified from a plan. ELB checks it by writing a
  # test object while the load balancer is being created, and the failure is an
  # apply-time "Access Denied for bucket" with no further detail.
  # ---------------------------------------------------------------------
  dynamic "access_logs" {
    for_each = var.access_logs.enabled ? [1] : []

    content {
      enabled = true
      bucket  = var.access_logs.bucket
      prefix  = var.access_logs.prefix
    }
  }

  tags = {
    Name = var.names.alb
    Tier = "edge"
  }
}

# ---------------------------------------------------------------------------
# Target group
# ---------------------------------------------------------------------------

resource "aws_lb_target_group" "api" {
  name        = var.names.target_group_api
  port        = var.api_container_port
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip" # awsvpc: the task has its own ENI, not a host port

  # ---------------------------------------------------------------------
  # Deregistration delay — 60 seconds.
  #
  # This is not sized from process exit time. The container's clean SIGTERM
  # shutdown measures ~97 ms on an idle task, and if that were the
  # question the answer would be "1". It is not: deregistration delay is the
  # window in which the load balancer has stopped sending *new* requests to a
  # target but existing connections are still finishing. Stopping the task
  # before that window closes is what turns a deploy into a burst of 502s.
  #
  # 60 s is chosen against what actually holds a connection open here:
  #
  #   - the slowest ordinary request the API serves (a presigned-upload round
  #     trip, a report query) is seconds, not minutes;
  #   - Socket.IO clients hold a long-lived connection and reconnect on close.
  #     60 s lets a heartbeat cycle complete and the client re-establish against
  #     a healthy task rather than being cut mid-frame;
  #   - the AWS default is 300 s, which adds five minutes to every deploy and to
  #     every scale-in event for no benefit this workload can name.
  #
  # It pairs with stop_timeout_seconds (30 s) in the task definition: ECS
  # deregisters the target, waits out this delay, then sends SIGTERM and allows
  # that long again before SIGKILL. Total worst case ~90 s per task.
  # ---------------------------------------------------------------------
  deregistration_delay = var.deregistration_delay_seconds

  # Send each request to the target with the fewest requests in flight rather
  # than round-robin. With a small number of tasks and uneven request costs,
  # round-robin queues work behind a task that is already busy.
  load_balancing_algorithm_type = "least_outstanding_requests"

  health_check {
    enabled = true

    # /health/ready, not /health/live — and this is the exact reason v0.1 split
    # the two probes. Liveness answers "is the process up?", which is the
    # container health check's question and the right one for Docker/ECS to kill
    # on. Readiness answers "can this task serve a request end to end?", which
    # includes Postgres and Redis, and it is the load balancer's question: a
    # task that cannot reach its database should stop receiving traffic without
    # being killed, because the database coming back should heal it.
    path                = var.health_check_path
    protocol            = "HTTP"
    matcher             = "200"
    interval            = 15
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  # ---------------------------------------------------------------------
  # Stickiness — required, not a performance tweak.
  #
  # socket.io-client defaults to the transport ladder ["polling", "websocket"]:
  # it opens an HTTP long-polling session, then upgrades. Those first few
  # polling requests are separate HTTP requests carrying a session id that only
  # the task that issued it knows about, so across two tasks without affinity
  # the handshake fails with "Session ID unknown" and the client retries
  # forever.
  #
  # The Socket.IO Redis adapter does not solve this. It fans *broadcasts* out
  # across tasks; it does not make a polling session portable between them.
  #
  # The alternative is to pin the clients to `transports: ['websocket']`, which
  # skips polling entirely — but that lives in apps/web and apps/admin, and an
  # infrastructure change that silently depends on a frontend option is how this
  # breaks six months from now. So the affinity is declared here.
  # ---------------------------------------------------------------------
  stickiness {
    enabled         = var.session_stickiness_enabled
    type            = "lb_cookie"
    cookie_duration = var.session_stickiness_duration_seconds
  }

  tags = {
    Name = var.names.target_group_api
    Tier = "edge"
  }

  # No create_before_destroy here, deliberately. It is the usual reflex for a
  # target group a listener depends on — and it cannot work against a fixed
  # name, because ELBv2 target group names are unique per region and the
  # replacement would collide with the incumbent. The alternative, name_prefix,
  # would mean the target group is the one resource in this stack not named from
  # local.names. Replacement is rare (port, protocol, target_type or VPC) and
  # Terraform sequences the listener update around it.
}

# ---------------------------------------------------------------------------
# Certificate for the API hostname
#
# Regional, in the stack's own region — deliberately NOT the edge module's
# us-east-1 certificate. That one exists because CloudFront will only accept a
# us-east-1 certificate; an ALB will only accept one from its own region. They
# cover overlapping names and neither can substitute for the other.
# ---------------------------------------------------------------------------

resource "aws_acm_certificate" "api" {
  count = local.custom_domain_enabled ? 1 : 0

  domain_name       = var.api_hostname
  validation_method = "DNS"

  lifecycle {
    # A certificate cannot be replaced while a listener references it.
    create_before_destroy = true
  }

  tags = {
    Name = var.api_hostname
    Tier = "edge"
  }
}

resource "aws_route53_record" "certificate_validation" {
  # Iterating the count list rather than indexing [0] keeps this valid when the
  # certificate is not created at all.
  for_each = {
    for option in flatten([for certificate in aws_acm_certificate.api : tolist(certificate.domain_validation_options)]) :
    option.domain_name => option
  }

  zone_id         = var.hosted_zone_id
  name            = each.value.resource_record_name
  type            = each.value.resource_record_type
  records         = [each.value.resource_record_value]
  ttl             = 60
  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "api" {
  count = local.custom_domain_enabled ? 1 : 0

  certificate_arn         = aws_acm_certificate.api[0].arn
  validation_record_fqdns = [for record in aws_route53_record.certificate_validation : record.fqdn]

  timeouts {
    # On a zone that has not been delegated at the registrar yet, validation
    # never completes. Fail in 30 minutes with a clear timeout rather than
    # hanging for the provider's default hour — same reasoning as the edge
    # module's certificate.
    create = "30m"
  }
}

# ---------------------------------------------------------------------------
# Listeners
# ---------------------------------------------------------------------------

resource "aws_lb_listener" "https" {
  count = local.custom_domain_enabled ? 1 : 0

  load_balancer_arn = aws_lb.api.arn
  port              = 443
  protocol          = "HTTPS"

  # TLS 1.2 floor, forward secrecy only. TLS 1.3 is included; the 1.0/1.1
  # policies AWS still offers exist for clients this application does not have.
  ssl_policy = "ELBSecurityPolicy-TLS13-1-2-2021-06"

  # The validation resource, not the certificate: referencing it here is what
  # orders the listener after validation actually completes, instead of after
  # the certificate object merely exists in a PENDING_VALIDATION state.
  certificate_arn = aws_acm_certificate_validation.api[0].certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }

  tags = {
    Name = "${var.names.alb}-https"
  }
}

# Port 80. Two entirely different jobs depending on whether TLS is available.
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.api.arn
  port              = 80
  protocol          = "HTTP"

  dynamic "default_action" {
    for_each = local.custom_domain_enabled ? [1] : []

    content {
      # 301, not 302: the redirect is a permanent property of the deployment,
      # and a permanent redirect is what lets browsers and HSTS preload skip the
      # cleartext hop entirely on subsequent visits.
      type = "redirect"

      redirect {
        protocol    = "HTTPS"
        port        = "443"
        status_code = "HTTP_301"
      }
    }
  }

  # ---------------------------------------------------------------------
  # !!  TEST ONLY  !!
  #
  # With no domain there is no ACM certificate, and this listener serves the
  # API over PLAIN HTTP on the load balancer's *.elb.amazonaws.com hostname.
  # Every request and response — access tokens in Authorization headers,
  # refresh tokens in cookies, password payloads, Stripe webhooks — crosses the
  # public internet in the clear and is readable and modifiable by anything on
  # the path.
  #
  # This exists so `terraform apply` with no domain produces something that
  # works end to end for a demo. It is NOT a deployment posture. Two ways out,
  # both cheap:
  #
  #   1. set domain_name in terraform.tfvars — the stack then issues an ACM
  #      certificate for api.<domain> and this listener becomes a redirect; or
  #   2. set edge_api_distribution_enabled in edge.tf, which puts CloudFront in
  #      front of the ALB and gives you HTTPS on a *.cloudfront.net hostname
  #      with no domain at all.
  #
  # The root stack raises a check warning on every plan while this branch is
  # the one in force.
  # ---------------------------------------------------------------------
  dynamic "default_action" {
    for_each = local.custom_domain_enabled ? [] : [1]

    content {
      type             = "forward"
      target_group_arn = aws_lb_target_group.api.arn
    }
  }

  tags = {
    Name = "${var.names.alb}-http"
  }
}

# ---------------------------------------------------------------------------
# DNS
#
# Alias, not CNAME: an alias record is free to resolve, follows the load
# balancer's changing addresses, and works at a zone apex should the API ever
# move to one. No AAAA record — the ALB is IPv4-only, see above.
# ---------------------------------------------------------------------------

resource "aws_route53_record" "api" {
  count = local.custom_domain_enabled ? 1 : 0

  zone_id = var.hosted_zone_id
  name    = var.api_hostname
  type    = "A"

  alias {
    name                   = aws_lb.api.dns_name
    zone_id                = aws_lb.api.zone_id
    evaluate_target_health = true
  }
}
