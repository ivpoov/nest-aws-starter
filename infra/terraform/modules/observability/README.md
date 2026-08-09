# `observability` module

Log retention, an error metric filter over the application's structured logs,
CloudWatch alarms, the alert topic they publish to, the shared access-log
bucket, and the account's monthly cost budget.

Wired from `infra/terraform/observability.tf`. The module takes resolved values
only: names from `local.names` and the root's `local.observability_names`, the
posture knobs from `local.profile`, and every alarm dimension from another
module's output. Nothing below this boundary compares `var.cost_profile`.

## What is created on which profile

| | demo | production |
|---|---|---|
| Alert SNS topic (+ email subscription) | yes | yes |
| Error metric filter | yes | yes |
| **Monthly budget** | **yes** | **yes** |
| CloudWatch alarms | no | yes |
| Container Insights log group | no | yes |
| Access-log bucket | no | yes |

The budget is the row that matters. Everything else in this module answers *is
the application healthy*; the budget answers *is this stack still running three
weeks after the afternoon you spent trying it out*, which is the failure mode a
public starter that provisions a VPC, an RDS instance and a load balancer
actually causes. It has no enable flag and does not vary by profile.

## Log groups this module does *not* create

`modules/compute/cluster.tf` already declares `/aws/ecs/<prefix>/api` and
`/aws/ecs/<prefix>/migrations` with `retention_in_days` from the same profile
key, and `modules/services/iam.tf` withholds `logs:CreateLogGroup` from the
execution role so the awslogs driver cannot create an unretained one behind
their back. `modules/network/flow-logs.tf` does the same for VPC flow logs.
Declaring any of them here would be a second Terraform address for one log group
and an "already exists" on apply.

What was left was the group nobody declares: Container Insights writes
performance events to `/aws/ecs/containerinsights/<cluster>/performance`, and if
ECS is the one to create it, its retention is *never expire*. That is the whole
category of cost this module's retention story is about — not large, but
permanent and invisible.

## The error metric filter

Read `apps/api/src/modules/logger/services/custom-logger.service.ts` before
changing the pattern. In production (`NODE_ENV=production`, which `compute.tf`
sets) `CustomLoggerService.printMessages` writes one JSON object per line and
nothing else:

```json
{"level":"error","context":"PaymentService","message":"…","timestamp":"2026-01-01T00:00:00.000Z","requestId":"…"}
```

`level` is a Nest `LogLevel` verbatim — `verbose | debug | log | warn | error |
fatal`, lowercase — so the pattern is:

```
{ $.level = "error" || $.level = "fatal" }
```

Two things this deliberately does not do. It does not match `warn`: a warning is
something the application handled. And it does not try to match plain text — the
lines Node writes before `app.useLogger()` runs in `main.ts`, and an uncaught
exception's stack trace, are not JSON and never will match. Those are startup
and crash signals, and `api_no_healthy_hosts` is the alarm that covers them.

`default_value = "0"` on the transformation matters more than it looks: without
it the metric has no datapoints at all while the service is healthy, and the
alarm sits in `INSUFFICIENT_DATA` — which is exactly what an alarm watching a
metric that does not exist also looks like.

## Why the alert topic is not the application's topic

`modules/services/sns.tf` already owns a topic. That one is a data plane: the
ECS task role holds `sns:Publish` on it and the application publishes domain
events through it. This one is a control plane. Sharing them would mean every
application event reaching the on-call address, every alarm reaching the
application's consumers, and anything holding the task role being able to publish
a message indistinguishable from a CloudWatch alarm.

## Zero running tasks, twice

`RunningTaskCount` is the literal answer and it only exists in the
`ECS/ContainerInsights` namespace — the free `AWS/ECS` namespace publishes CPU
and memory utilisation, which are *absent* rather than zero when a service has no
tasks. So that alarm is created only where Container Insights is.

`HealthyHostCount < 1` on the target group is the one that exists everywhere. It
is free, and it answers the question users actually have: is there anything
behind the load balancer that can serve a request? Zero covers both "no tasks"
and "tasks that never became healthy", which is why it is the one with
`treat_missing_data = "breaching"`.

## Access-log bucket

Created only when the profile sets `access_logs_enabled`, and consumed by two
writers under two prefixes:

- `cloudfront/<site>/` — the edge module's distributions, wired through
  `access_logs_bucket_domain_name` into `log_bucket_domain_name`;
- `alb/` — the compute module's load balancer, wired through the
  `alb_access_logs` output into its `access_logs` input.

**ACLs are enabled on it**, uniquely in this stack — every other bucket sets
`BucketOwnerEnforced`. CloudFront standard logging predates that setting and
delivers by writing objects with an ACL grant to the `awslogsdelivery` canonical
user; a `BucketOwnerEnforced` bucket rejects the write and surfaces the failure
nowhere in CloudFront. `BucketOwnerPreferred` plus a full public access block is
the weakest configuration that still works.

The ALB does not use ACLs at all. It delivers as an AWS-owned identity and needs
a **bucket policy** naming it — the per-Region ELB account in a Region launched
before August 2022, or the `logdelivery.elasticloadbalancing.amazonaws.com`
service principal in one launched since. `alb_log_delivery_uses_regional_account`
picks between them; the service-principal statement is granted either way.

Two things about that policy are worth knowing before an apply:

1. **It cannot be verified from a plan.** ELB validates the policy by writing a
   test object while the load balancer is being created. A wrong policy is an
   apply-time `Access Denied for bucket`, and nothing before that says so.
2. **Ordering runs through the `alb_access_logs` output**, which carries a
   `depends_on` on the bucket policy. Depending on the bucket alone would let
   Terraform create the load balancer first, and it would fail that write test.
