# 10. Two cost profiles, and the no-NAT trade-off

Status: accepted

## Context

An AWS starter has to answer a question most reference architectures dodge: *what does it
cost to leave running?* A reader evaluating the project will `terraform apply` it once. If
the default stack is a three-AZ, multi-AZ-RDS, NAT-per-AZ production topology, that first
apply costs well over a hundred dollars a month, and the reader either never applies it or
is unpleasantly surprised.

The opposite failure is worse: a cheap demo topology that quietly *is* the production
topology, so the first real deployment inherits a single-AZ database with one day of
backups and no alarms.

The largest single line item in a small AWS stack is usually not compute. A NAT gateway is
roughly $32 per month per gateway before a byte of traffic, and the "correct" answer is one
per availability zone, so private subnets with internet egress cost about $96/month in a
three-AZ layout — often more than everything else combined.

## Decision

One variable, `cost_profile`, with exactly two values: `demo` (the default) and
`production`. It resolves to a settings map in `infra/terraform/locals.tf`, and
**nothing downstream ever compares `var.cost_profile` again** — every module reads
`local.profile.<key>`. The two maps must have identical key sets. CI enforces the discipline
by running `tflint` against both profiles.

The 27 keys that differ:

| Concern | `demo` | `production` |
|---|---|---|
| Availability zones | 2 | 3 |
| Private subnets | off | on |
| NAT gateways budgeted | 0 | 3 (one per AZ) |
| VPC interface endpoints | off | unlocked |
| VPC flow logs | off | on |
| Redis | in-task `redis:8-alpine` sidecar | ElastiCache, 2 nodes, Multi-AZ failover |
| RDS instance / storage | `db.t4g.micro`, 20 GB | `db.t4g.small`, 50 GB |
| RDS Multi-AZ / backups / PI | off / 1 day / off | on / 14 days / on |
| Fargate capacity provider | `FARGATE_SPOT` | `FARGATE` |
| Task size / count | 256 CPU, 512 MB, 1 task | 512 CPU, 1024 MB, 2 tasks |
| Autoscaling | off (1–1) | on (2–6, CPU target 60 %) |
| CloudFront price class | `PriceClass_100` | `PriceClass_All` |
| CloudFront access logs | off | on (creates the log bucket) |
| Log retention | 7 days | 30 days |
| Container Insights / alarms | off / off | on / all 7 alarms |
| Deletion protection | off | on (RDS **and** ALB) |
| `force_destroy` buckets / ECR | on | off |
| RDS final snapshot | skipped | taken |

Two knobs are deliberately *decoupled* rather than derived, and the code says why:

- **Private subnets are separate from NAT.** Subnets and route tables are free; egress from
  them is not. Keying the private tier off the NAT flag made "I want workloads off the public
  internet" and "I will pay ~$32/month per AZ" the same sentence.
- **Managed cache is separate from task count.** It used to be derived from
  `compute_max_capacity > 1`, so editing a capacity number could conjure a ~$12/month
  replication group as a side effect. A `check` block enforces the relationship instead.

### The no-NAT trade-off

On the `demo` profile there are **no private subnets and no NAT gateway**. ECS tasks run in
public subnets with `assign_public_ip = true`. The network module makes the call and the
compute module consumes it rather than re-deriving it:

```hcl
output "workload_subnet_ids" {
  value = length(aws_subnet.private) > 0 ? aws_subnet.private[*].id : aws_subnet.public[*].id
}
output "workload_subnets_are_public" {
  value = length(aws_subnet.private) == 0
}
```

The three ways a Fargate task can reach ECR, CloudWatch Logs and SSM are a NAT gateway
(~$32/month each), interface VPC endpoints (~$7/month per endpoint per AZ, and it needs four
of them), or a public IP on the task, which is free. The demo profile takes the third. An
S3 *gateway* endpoint is created unconditionally on both profiles because it is free and
carries the ECR layer traffic.

## Consequences

**Good**

- The default apply is cheap enough to leave running while you evaluate the project, and the
  monthly budget alarm (default $20) is created on both profiles.
- Going to production is one variable, not a rewrite. The delta is auditable in one file
  rather than scattered across `count` expressions.
- Because every module reads `local.profile.*`, a reviewer can see the entire cost surface
  by reading one map. Adding a profile key with no resource behind it is caught in review;
  the one existing exception is flagged loudly (see below).

**Bad — pay these knowingly**

- **On `demo`, application tasks and the RDS subnet group sit in public subnets.** The
  security groups are the only boundary: the API security group admits the load balancer's
  security group on one port and nothing else, the database SG admits the API SG on 5432 and
  has no egress rules at all, and RDS is `publicly_accessible = false`. That is a real
  boundary, and it is a *different* boundary from "unroutable from the internet". A
  misconfigured security group in a private-subnet topology fails closed; here it fails open.
  Do not run `demo` with real user data.
- **`FARGATE_SPOT` on demo means tasks can be reclaimed with two minutes' notice**, and with
  `desired_count = 1` that is a visible outage, not a rolling replacement.
- **Demo is a single task, so two production code paths are never exercised there** — the
  scheduler's Redis lock and the Socket.IO Redis adapter are both no-ops at one instance. A
  `check` block says so, and warns that fixing it takes two edits, not one.
- **The demo cache is ephemeral.** Redis runs as a sidecar in the same task with
  `--save "" --appendonly no --maxmemory 128mb --maxmemory-policy allkeys-lru`. Combined with
  [ADR 3](./0003-tokens-in-redis-never-postgres.md) — tokens live only in Redis — a task
  restart on the demo profile logs every user out, and `allkeys-lru` can evict a live session
  under memory pressure.
- **Production at defaults is not deployable as-is.** `production` sets
  `private_subnets_enabled = true` and `nat_gateway_enabled = true`, but the actual creation
  is gated on `var.enable_nat`, which defaults to `false`, and `var.interface_endpoints`,
  which defaults to `[]`. So the default production plan produces private subnets with no
  egress: tasks cannot pull from ECR and fail to start with an image-pull timeout. This is
  caught by `check "tasks_without_egress"`, which is a **plan warning, not an error** — you
  can apply straight into it. Choosing egress is left as a deliberate, priced decision, but a
  reader who assumes `cost_profile = "production"` is sufficient will hit it.
- **`waf_enabled = true` on production buys nothing today.** The profile key and the name
  exist, `local.edge_web_acl_arn` is hardcoded to `null`, and there is no `aws_wafv2_*`
  resource anywhere in the tree. It is the one acknowledged violation of the "a profile key
  with no resource behind it comes back out" rule, kept visible by a `check` block and
  documented in the Terraform README.
- **Two profiles is not a spectrum.** There is no `staging`. A team that wants Multi-AZ RDS
  without three NAT gateways has to add a third profile or override individual variables,
  and the second option partly defeats the "one variable, one file" property.
