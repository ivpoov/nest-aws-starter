# Going to production

The demo stack is designed to be thrown away. This page is the bridge from that
stack to one a business can run on: what `cost_profile = "production"` actually
changes, what it deliberately leaves for you, and what this starter does not do
at all.

> **Designed, not proven.** No `terraform apply` has ever been run against real
> AWS from this repository. Every claim below is traceable to a file in
> `infra/terraform/` — the configuration is real, the reasoning is real, the
> costs are the ones written into the code's own comments. What has *not*
> happened is a deployment that confirms AWS behaves as the configuration
> expects. Treat the procedures here as a starting point to validate in your own
> account, not as a tested runbook.
>
> Where a command is quoted, it is quoted from a file in this repository that
> runs it (`.github/workflows/deploy.yml`) or from the AWS CLI's documented
> shape. Anything you are meant to verify before trusting is marked.

Prerequisites: read [ADR 10](../decisions/0010-two-cost-profiles-and-the-no-nat-trade-off.md)
for why there are two profiles at all, and
[`infra/terraform/README.md`](../../infra/terraform/README.md) for how to run the
stack.

---

## 1. What `cost_profile = "production"` actually flips

One variable selects one of two maps in
[`infra/terraform/locals.tf`](../../infra/terraform/locals.tf). Both maps carry
the **same 31 keys**, and every one of them holds a different value. Nothing
below a module boundary ever compares `var.cost_profile`; modules read
`local.profile.<key>`.

These are the literal values in `local.profile_settings`, not a summary:

### Network

| Key | `demo` | `production` |
| --- | --- | --- |
| `az_count` | `2` | `3` |
| `private_subnets_enabled` | `false` | `true` |
| `nat_gateway_enabled` | `false` | `true` |
| `nat_gateway_count` | `0` | `3` |
| `vpc_endpoints_enabled` | `false` | `true` |
| `vpc_flow_logs_enabled` | `false` | `true` |

### Data

| Key | `demo` | `production` |
| --- | --- | --- |
| `managed_cache_enabled` | `false` | `true` |
| `database_instance_class` | `db.t4g.micro` | `db.t4g.small` |
| `database_allocated_storage_gb` | `20` | `50` |
| `database_multi_az` | `false` | `true` |
| `database_backup_retention_days` | `1` | `14` |
| `database_performance_insights` | `false` | `true` |
| `cache_node_type` | `cache.t4g.micro` | `cache.t4g.small` |
| `cache_replica_count` | `0` | `1` |

### Compute

| Key | `demo` | `production` |
| --- | --- | --- |
| `compute_use_fargate_spot` | `true` | `false` |
| `compute_task_cpu` | `256` | `512` |
| `compute_task_memory` | `512` | `1024` |
| `compute_desired_count` | `1` | `2` |
| `compute_autoscaling` | `false` | `true` |
| `compute_min_capacity` | `1` | `2` |
| `compute_max_capacity` | `1` | `6` |

### Edge and observability

| Key | `demo` | `production` |
| --- | --- | --- |
| `waf_enabled` | `false` | `false` — **the one key equal on both profiles; see §5** |
| `cloudfront_price_class` | `PriceClass_100` | `PriceClass_All` |
| `access_logs_enabled` | `false` | `true` |
| `log_retention_days` | `7` | `30` |
| `container_insights` | `false` | `true` |
| `alarms_enabled` | `false` | `true` |

### Lifecycle

| Key | `demo` | `production` |
| --- | --- | --- |
| `deletion_protection` | `false` | `true` |
| `force_destroy_bucket` | `true` | `false` |
| `skip_final_snapshot` | `true` | `false` |
| `custom_domain_expected` | `false` | `true` |

### What the profile does *not* do

Switching the variable is necessary and not sufficient. Four things are still
yours:

1. **Egress.** `production` sets `nat_gateway_enabled = true` and
   `nat_gateway_count = 3`, but the gateways are only created when
   `var.enable_nat` is also true — and it **defaults to `false`**. Same for
   `vpc_endpoints_enabled = true`, which only unlocks `var.interface_endpoints`,
   default `[]`. The default production plan therefore produces private subnets
   with no route out, and Fargate tasks that cannot reach ECR. `check
   "tasks_without_egress"` in `compute.tf` warns about exactly this — and a
   `check` is a **plan warning, not an error**. You can apply straight into it.
   See §3.
2. **`alert_email`.** Required by variable validation on this profile: alarms
   with nowhere to go are worse than no alarms. AWS then emails a subscription
   confirmation, and the subscription stays `PendingConfirmation` until someone
   clicks it. A green apply is not evidence that alerts are delivered — read
   `terraform output alerts_subscription_notice`.
3. **`domain_name`.** `custom_domain_expected = true` only drives a warning. With
   no domain there is no regional ACM certificate on the ALB and the API is
   served over **plain HTTP** on its `*.elb.amazonaws.com` hostname —
   `check "api_served_over_plain_http"` says so on every plan.
4. **The WAF.** See §5.

Run `terraform output cost_profile_settings` after a plan to see the resolved map
rather than trusting this page.

---

## 2. Multi-AZ, failover, and read replicas

### What you get

- **Three availability zones** (`az_count = 3`). The ALB spans all three public
  subnets; the private tier, the RDS subnet group and the ECS tasks follow.
- **RDS Multi-AZ** (`database_multi_az = true`) — a synchronous standby in a
  second AZ that AWS fails over to. It roughly doubles the instance bill, and it
  is the difference between an AZ failure being a failover and being an outage.
- **ElastiCache failover.** `cache_replica_count = 1` is what turns it on: the
  data module derives both `automatic_failover_enabled` and `multi_az_enabled`
  from `cache_replica_count > 0`, so they cannot contradict the node count.
- **One NAT gateway per AZ** when NAT is enabled, each with its own route table,
  because a shared gateway is a cross-AZ single point of failure and cross-AZ NAT
  traffic is billed as inter-AZ transfer on top.
- **Two tasks minimum** (`compute_min_capacity = 2`) on on-demand Fargate, not
  Spot.

### What you do not get, and should not assume

**There is no read replica.** `modules/data/rds.tf` declares one
`aws_db_instance` with no `replicate_source_db` anywhere in the tree, and the
application receives exactly one `DATABASE_URL`. RDS Multi-AZ in the
*instance* deployment this stack uses is a **standby, not a reader** — you
cannot query it, and turning it on buys availability, not read capacity.

Adding read scaling is not a Terraform-only change:

- Terraform side: a second `aws_db_instance` with `replicate_source_db` pointed
  at the primary, in the same subnet group and security group.
- Application side: `apps/api` resolves Prisma through a single client. Routing
  reads to a replica means a second client and a rule for which queries are
  replica-safe — replication is asynchronous, so a read-after-write against the
  replica can legitimately return stale data. That is an application design
  decision, not a knob.

Reach for Performance Insights (`database_performance_insights = true` on this
profile, free at the 7-day retention the module sets) and the `db.t4g.*` class
ladder before a replica. Most starter-shaped workloads are one instance class
away from fine.

**The cache is a replication group, not a durable store.** ElastiCache holds the
refresh-token allowlist ([ADR 3](../decisions/0003-tokens-in-redis-never-postgres.md)),
the throttler counters and OAuth state. `cache_snapshot_retention_days` defaults
to `0` — deliberately, because all of it regenerates. The consequence is that a
total cache loss signs every user out. That is recoverable; plan for the support
tickets, not for a restore.

---

## 3. NAT gateways versus VPC endpoints

This is the single largest cost decision in the stack, and it is deliberately
left as an explicit, priced choice rather than something a profile flips.

A Fargate task pulls its image from ECR, opens a CloudWatch Logs stream and
resolves its SSM secrets over public AWS endpoints. In a private subnet it needs
a route to them. There are three ways to have one, and the numbers below are the
ones written into the repository's own comments
(`network.tf`, `modules/network/endpoints.tf`, ADR 10):

| Path | Cost | What it covers |
| --- | --- | --- |
| **S3 gateway endpoint** | **free** — a route table entry, no ENI, no hourly charge | S3, and therefore ECR *layers*. Created unconditionally on both profiles. |
| **NAT gateway** | ~$0.045/hour ≈ **~$32/month per gateway** before any data processing. One per AZ on this profile ⇒ **~$96/month standing** | Everything. Any destination, AWS or not. |
| **Interface VPC endpoints** | ~$0.01/hour ≈ **~$7/month per endpoint per AZ**, plus per-GB processing | Only the named AWS services. |

The reflex set — `ecr.api`, `ecr.dkr`, `logs`, `ssm` — across three AZs is 12
ENIs, roughly **$84/month**: near enough to the NAT bill that "endpoints are the
cheap alternative to NAT" is simply false at this scale. Endpoints earn their
place on a workload with *steady* AWS API traffic, where they remove the NAT
data-processing charge and keep the calls off the public internet.

### For this application specifically

**Endpoints alone are not sufficient.** `apps/api` makes outbound calls to
destinations that have no AWS endpoint at all: Stripe's API, and the token
endpoints of every enabled OAuth provider (Google, Facebook, Discord). Private
tasks with interface endpoints and no NAT will start, pull images and log
happily — and then fail every payment and every social login, at runtime, with
connection timeouts that name none of this.

So the honest matrix:

| Your posture | Do this |
| --- | --- |
| Payments and OAuth off; all egress is AWS | `interface_endpoints = ["ecr.api", "ecr.dkr", "logs", "ssm"]`, `enable_nat = false` |
| Payments or OAuth on | `enable_nat = true`. Add endpoints on top only when the data-processing charge justifies them. |
| Cost matters more than private subnets | Keep workloads in public subnets with `assign_public_ip` — free, and what the demo profile does. The security groups are still the boundary. **Do not run real user data this way**; a misconfigured security group in a private topology fails closed, here it fails open. |

The API security group enumerates its egress rather than allowing all: 443
anywhere, DNS to the VPC resolver (UDP *and* TCP), NTP to the Amazon Time Sync
link-local address, and the database and cache ports by security-group
reference. If your workload calls something on a non-443 port, widen it
deliberately in `modules/network/security-groups.tf`.

`terraform output nat_gateway_public_ips` gives the egress addresses for third
parties that allowlist by source IP. It is empty unless NAT was actually
enabled.

---

## 4. RDS Proxy, and the pool math this project has carried since v0.1

### The constraint

Every task holds its own Prisma connection pool, sized by `connection_limit` in
`DATABASE_URL`. The arithmetic that matters is:

```
max task count × database_connection_limit ≤ max_connections − reserved
```

`check "database_connection_pool"` in `datastores.tf` enforces a fixed ceiling of
**90**:

```hcl
condition = local.profile.compute_max_capacity * var.database_connection_limit <= 90
```

At this profile's defaults — `compute_max_capacity = 6`,
`database_connection_limit = 10` — that is 60, and it passes. The 90 is derived
from `db.t4g.micro`, which lands near 112 `max_connections` with three reserved
for superusers. `db.t4g.small`, which this profile runs, lands near 225, so the
check is *conservative* in production, which is the safe direction to be wrong
in.

Two things the check does not model, and you should:

1. **A rolling deploy runs both revisions.** The service sets
   `deployment_minimum_healthy_percent = 100` and
   `deployment_maximum_percent = 200`, so during a deploy the task count can
   briefly double. At a scaled-out six tasks that is twelve pools — 120
   connections — plus the migration task and any `psql` session you have open.
   Comfortable on `db.t4g.small`; not comfortable if you raise
   `compute_max_capacity` without doing the arithmetic again.
2. **Exhaustion does not degrade.** New connections are refused and the API
   returns 500s until something restarts. There is no partial mode.

This is why the pool ceiling has been a standing constraint on how far this stack
can scale out: **every task you add costs `connection_limit` connections whether
it is serving traffic or idling.**

### What RDS Proxy changes

RDS Proxy sits between the tasks and the instance, maintains a warm pool of
database connections, and multiplexes many client connections onto few database
ones. It closes the loop in two ways:

- **Task count stops being a database constraint.** Adding tasks adds proxy
  clients, not database backends. `compute_max_capacity` becomes a compute
  decision again.
- **Failover gets shorter.** The proxy holds client connections open across an
  RDS failover instead of every task seeing its socket drop and reconnecting.

**It is not in this stack.** There is no `aws_db_proxy` resource anywhere in
`infra/terraform/`. Adding it is a real piece of work, and one part of it fights
a decision made elsewhere in the tree:

1. `aws_db_proxy` with `engine_family = "POSTGRESQL"`, in the same private
   subnets, plus an `aws_db_proxy_default_target_group` and an
   `aws_db_proxy_target` pointing at the instance.
2. **A Secrets Manager secret.** RDS Proxy authenticates to the database using a
   secret it reads from **Secrets Manager**, and this stack deliberately stores
   every credential in **SSM Parameter Store** — because Standard-tier parameters
   are free and Secrets Manager is ~$0.40 per secret per month "for rotation
   nothing here uses" (`modules/data/parameters.tf`). Adding a proxy means adding
   one Secrets Manager secret holding the master username and password, and an
   IAM role the proxy assumes to read it. This is the one place the SSM decision
   has a concrete cost.
3. A security group path: the proxy needs ingress from the API tasks on 5432, and
   egress to the database group. The current chain wires the API group straight
   to the database group.
4. Repoint `DATABASE_URL` at the proxy endpoint. It is assembled in
   `modules/data/parameters.tf` from `aws_db_instance.this.address`; it would take
   the proxy's endpoint instead. Keep `sslmode=require` — `rds.force_ssl = 1` is
   set in the parameter group and the proxy terminates TLS too.
5. Raise `database_connection_limit` (that is the point) and revisit the check's
   `90`, which would no longer describe the real constraint.

Billing is per vCPU-hour of the database instance the proxy fronts; check the
current RDS Proxy pricing page for your region before committing — this
repository has no verified figure to quote.

### Until then

Cheaper levers, in the order worth trying:

- Lower `database_connection_limit`. Prisma's pool is per task; ten is generous
  for a task serving a few hundred requests a minute.
- Raise `database_instance_class`. `max_connections` on RDS PostgreSQL scales
  with memory, so a class bump raises the ceiling and the CPU headroom together.
- Cap `compute_max_capacity` honestly, and let the CPU alarm tell you when that
  cap is the thing hurting you.

---

## 5. WAF on CloudFront — the gap, and the recommendation

### The fact

`waf_enabled = true` on the production profile **creates nothing**. There is no
`aws_wafv2_*` resource anywhere in `infra/terraform/`. `local.edge_web_acl_arn`
in `edge.tf` is hardcoded to `null`, and it is what the edge module's
`web_acl_arn` receives. The stack is honest about it in three places: a `check
"edge_supporting_resources"` that warns on every plan, a "What this stack does
not create" section in the Terraform README, and a "Bad — pay these knowingly"
bullet in ADR 10.

### The recommendation: set `waf_enabled = false` until a module exists

A profile key that reads as enabled everywhere it is displayed — in
`terraform output cost_profile_settings`, in the `CostProfile` tag conversation,
in a code review — and silently does nothing is worse than a key that says
`false`. It is the kind of thing that gets read as "WAF: yes" in a security
questionnaire.

There is a second, sharper reason, and it is specific to this stack's topology:

**Even a correctly built CloudFront web ACL would not protect the API.**
`local.edge_api_distribution_enabled` is `false`, so the only distributions the
edge module creates are the two static SPA sites — private S3 buckets of
content-hashed Vite output served through Origin Access Control. There is no
origin logic there to exploit, no request body to inspect, and no rate limit
worth writing. The thing a WAF would actually earn its keep in front of is the
**API**, and the API is served by an internet-facing ALB. Protecting that needs a
**REGIONAL** web ACL associated with the load balancer — a different scope, a
different resource, in a different region from the `CLOUDFRONT` one the key's
name (`local.names.waf_web_acl`) and the check's error message describe.

So the key as written points at the wrong tier. Turn it off, and treat "add a
WAF" as the design task it is.

### If you want one anyway

Two separate jobs. Do the second one first if you only do one.

**In front of the ALB (the useful one).** A `REGIONAL`-scoped
`aws_wafv2_web_acl` in the stack's own region, associated with the load balancer
via `aws_wafv2_web_acl_association`. Start with the AWS managed rule groups —
`AWSManagedRulesCommonRuleSet` and `AWSManagedRulesKnownBadInputsRuleSet` — plus a
rate-based rule. Two cautions specific to this application:

- The API is bearer-token, JSON, and CORS-allowlisted. Managed rule groups
  regularly flag legitimate JSON bodies; run in `count` mode first and read the
  logs before switching to `block`.
- Socket.IO's upgrade and long-polling traffic goes through the same load
  balancer at `/socket.io`. A rate-based rule tuned for REST will throttle
  websocket clients, which reconnect, which trips it harder.

**In front of CloudFront (the one the key names).** A `CLOUDFRONT`-scoped
`aws_wafv2_web_acl` created **in `us-east-1`** — the `aws.us_east_1` provider
alias already exists in `edge.tf` for the ACM certificate. Name it
`local.names.waf_web_acl`, then set `local.edge_web_acl_arn` to its ARN; the
module already threads `web_acl_arn` into every distribution's `web_acl_id`. Once
that ARN is non-null the `check` goes quiet, which is exactly the signal it was
built to give.

Only then is `waf_enabled = true` a true statement. Budget for it: a web ACL is
billed monthly, per rule, and per million requests.

---

## 6. Backup and restore

### What the stack actually backs up

| Thing | Mechanism | Retention on `production` |
| --- | --- | --- |
| PostgreSQL | RDS automated backups + point-in-time recovery | `database_backup_retention_days = 14` |
| PostgreSQL, on delete | Final snapshot (`skip_final_snapshot = false`) | Forever, billed, **not managed by this stack** |
| Uploaded files | S3 versioning on the uploads bucket | Noncurrent versions expire after 30 days (`uploads_noncurrent_version_retention_days`) |
| Terraform state | S3 versioning on the bootstrap bucket | Superseded versions expire by lifecycle rule |
| Redis | **nothing** — `cache_snapshot_retention_days = 0` | n/a, and deliberately |

Backups run in a pinned window, `03:00–04:00` UTC
(`database_backup_window`), chosen so it cannot collide with the maintenance
window (`sun:04:30–05:30` UTC) or, presumably, your traffic peak. Change both if
your peak is at 03:00 UTC. `copy_tags_to_snapshot = true` means a restored
snapshot arrives carrying the `Project`/`Environment` tags every cost report keys
off; without it, restores go untracked.

**Backup storage up to the size of the database is free.** Fourteen days costs
nothing extra unless your database is smaller than your churn.

### What it does not back up

- No **AWS Backup** plan, no backup vault, no vault lock.
- No **cross-region** snapshot copy. A region-wide event takes the backups with
  the database.
- No **snapshot export to S3**, so no long-term archive outside RDS's retention.
- No **restore test**, automated or otherwise. An untested backup is a hypothesis.

### Restore: the procedure, and the trap

The trap first, because it will bite you at the worst moment.

**`DATABASE_URL` is Terraform-owned and Terraform will overwrite it.**
`modules/data/parameters.tf` assembles the connection string from
`aws_db_instance.this.address` and writes it to
`/<project>/<environment>/DATABASE_URL` as a `SecureString`. Unlike the
`REPLACE_ME` placeholders, that parameter carries **no `ignore_changes`**. If you
restore to a differently-named instance and hand-edit the parameter to point at
it, the next `terraform apply` silently points production back at the broken
database.

The restore path that survives an apply:

```bash
# 1. Restore to a NEW identifier. RDS never restores in place.
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier <project>-<env>-db \
  --target-db-instance-identifier <project>-<env>-db-restored \
  --restore-time 2026-01-01T12:00:00Z \
  --db-subnet-group-name <project>-<env>-db-subnets \
  --vpc-security-group-ids <database-sg-id> \
  --no-publicly-accessible

# 2. Verify it. Connect from a task or a bastion in the VPC — the instance is
#    not publicly accessible and the security group admits the API tasks only.

# 3. Rename, so the endpoint hostname returns to the one Terraform generated
#    DATABASE_URL from. Take the broken instance out of the way first.
aws rds modify-db-instance --db-instance-identifier <project>-<env>-db \
  --new-db-instance-identifier <project>-<env>-db-broken --apply-immediately
aws rds modify-db-instance --db-instance-identifier <project>-<env>-db-restored \
  --new-db-instance-identifier <project>-<env>-db --apply-immediately

# 4. Prove it before you trust it.
terraform plan   # DATABASE_URL must show no change
```

Step 3 relies on the RDS endpoint address being derived from the instance
identifier, so renaming restores the hostname. **Verify that with `terraform
plan` in step 4 rather than taking this page's word for it** — if the plan wants
to rewrite `DATABASE_URL`, the hostname did not come back and you are in the
alternative path below.

Alternative, when renaming is not viable: let Terraform own the restored
instance. `terraform state rm` the old `aws_db_instance`, `terraform import` the
restored one at the same address, and apply. Slower, noisier, and it does not
depend on hostname behaviour.

Either way, **restart the tasks afterwards**. ECS resolves the `secrets` block at
container start; a task that was running before the parameter changed is still
holding the old connection string. See §9.

`deletion_protection = true` on this profile means `terraform destroy` fails on
the RDS instance until someone turns it off deliberately. That is the intended
behaviour and it is what makes "durable" mean something — but it also means a
half-finished destroy leaves the instance behind. Check for it.

---

## 7. Secret rotation

### Where secrets live

Every secret the API boots with is one SSM Parameter Store `SecureString` under
`/<project_name>/<environment>/`, encrypted with the AWS-managed
`alias/aws/ssm` key. There are two kinds:

**Terraform-owned** — `AUTH_JWT_SECRET`, `DATABASE_URL`, `REDIS_URL`. Generated
or assembled by Terraform, rewritten on every apply.

**Placeholders** — the eight OAuth and Stripe credentials. Created holding
`REPLACE_ME` with `ignore_changes = [value]`, so filling one in out of band is
never reverted:

```bash
aws ssm put-parameter --name /<project>/<env>/STRIPE_SECRET_KEY \
  --value "$NEW_VALUE" --type SecureString --overwrite
```

`terraform output placeholder_parameter_names` lists the ones still holding the
sentinel; `terraform output secrets_action_required` prints the exact commands.

### The rule that governs every rotation

**ECS resolves the `secrets` block with the execution role at container start.**
The value is injected into the process environment and exists nowhere else — not
in the task definition, not in a plan, not on a console page. The consequence for
rotation is simple and absolute:

> A rotated secret reaches the application only when the task is replaced.

So every rotation is two steps:

```bash
# 1. write the new value (put-parameter, or terraform apply)
# 2. cycle the tasks
aws ecs update-service --cluster <cluster> --service <service> --force-new-deployment
```

Rolling replacement at 100/200 means no gap, and each task drains for the
deregistration delay before it stops (§9).

### Rotating each thing

**A third-party credential (Stripe, OAuth).** `put-parameter --overwrite`, then
force a new deployment. Nothing else moves. Note that during the rollout, old and
new tasks hold different credentials — for Stripe's *webhook* secret that means a
window where signatures signed with one secret are verified by tasks holding the
other. Stripe supports multiple signing secrets during a rotation; use that
rather than a flip.

**`AUTH_JWT_SECRET`.** Generated by `random_bytes.jwt_secret` (48 bytes, rendered
as 96 hex characters, which the API's boot guard scores at 384 bits).

```bash
terraform apply -replace=module.data.random_bytes.jwt_secret
```

**This signs every user out.** The parameter's own description says so:
regenerating it invalidates every issued access and refresh token. There is no
overlap window — the API validates against one secret. Rotate it when you have a
reason (a suspected leak), not on a schedule you invented.

**The database master password.** Generated by `random_password.database` and
spliced into `DATABASE_URL`.

```bash
terraform apply -replace=module.data.random_password.database
```

One apply changes both the instance and the parameter. Two cautions:

- `database_apply_immediately` defaults to **`false`**, so the modification may
  be deferred. Check `aws rds describe-db-instances --db-instance-identifier
  <id> --query 'DBInstances[0].PendingModifiedValues'` before you assume the
  instance has the new password.
- Running tasks hold the old string until they are replaced. Sequence it: confirm
  the instance has taken the new password, *then* force a new deployment. Between
  those two points a task that reconnects will fail to authenticate.

### What does not exist

- **No automatic rotation.** SSM Parameter Store has none. Secrets Manager, which
  does, was declined for cost (`modules/data/parameters.tf`) — "for rotation
  nothing here uses". If you add rotation, that trade changes.
- **No customer-managed KMS key.** Everything uses AWS-managed keys
  (`alias/aws/ssm`, the RDS key, `AES256` on S3 and ECR). A CMK would be stronger
  and needs `kms:Decrypt` added to both the task and execution roles, which the
  services module owns.
- **Secrets are in Terraform state.** The master password and the JWT secret are
  generated by Terraform and therefore live in the state file. That is why the
  bootstrap state bucket is versioned, encrypted and blocked from public access —
  and why **anyone with read access to that bucket holds your database password**.
  Scope it like a credential store, because it is one.

---

## 8. Scaling knobs

### Compute

| Knob | Where | Production value |
| --- | --- | --- |
| `compute_min_capacity` / `compute_max_capacity` | `locals.tf` | `2` / `6` |
| `autoscaling_target_cpu_percent` | `modules/compute/variables.tf` | `60` |
| `autoscaling_scale_out_cooldown_seconds` | same | `60` |
| `autoscaling_scale_in_cooldown_seconds` | same | `300` |
| `compute_task_cpu` / `compute_task_memory` | `locals.tf` | `512` / `1024` |

The policy is **CPU target-tracking only**. There is no request-count policy, no
memory policy, no scheduled action. A workload that saturates on IO, on the
database, or on connection count will sit at 30% CPU while queueing, and nothing
will scale it. If that is your shape, add an
`ALBRequestCountPerTarget` policy — the target group ARN suffix is already an
output.

Cooldowns are asymmetric on purpose: scale out promptly (a task costs cents an
hour and buys headroom now), scale in reluctantly (removing one costs nothing
until the load returns and the replacement boots cold). Scale-in stays **enabled**
— disabling it is the usual way a stack that scaled out once during a load test
bills for the extra tasks for a month.

`desired_count` is under `ignore_changes` on the service, because Application
Auto Scaling writes it on every scaling action. Do not try to set it in
Terraform; use `aws ecs update-service --desired-count` and let the scaling target
take it back.

Task CPU and memory must be a valid Fargate pair — the module restates AWS's
pairing table as a variable `validation`, so a bad pair fails at plan rather than
twenty resources into an apply.

The runtime platform is **X86_64**, because `apps/api/Dockerfile` pins its base
image by an amd64 digest. ARM64 Fargate is roughly 20% cheaper and would be the
better default; it needs a multi-arch build first, so changing
`cpu_architecture` alone produces a task that cannot start.

### Data

- `database_instance_class` — the ladder. Raises CPU, memory and
  `max_connections` together.
- `database_max_allocated_storage_gb` — **defaults to `0`, meaning storage
  autoscaling is off.** Set it. A full volume puts RDS into `STORAGE_FULL`, where
  it stops accepting writes — the one database failure with no partial mode — and
  autoscaling bills only for storage it actually grows into. The
  `database_free_storage` alarm exists to warn you, but a ceiling is cheaper than
  a page.
- `cache_node_type` / `cache_replica_count` — replicas above zero also buy
  automatic failover and Multi-AZ, which is the actual reason to pay for them.
- `database_connection_limit` — read §4 before raising the task ceiling.

### Edge

- `cloudfront_price_class = "PriceClass_All"` serves from every edge location.
  Drop to `PriceClass_100` (North America and Europe) if your users are there;
  it is a real saving on a global distribution.
- The caching split is fixed and load-bearing: `/assets/*` (content-hashed by
  Vite) cached long, everything else — including `index.html` and every
  client-side route — served no-cache. Getting that backwards is the classic SPA
  deploy failure.

### One thing that quietly caps scale-in

The target group enables `lb_cookie` stickiness for 24 hours. It is **required**,
not a tweak: socket.io-client's default transport ladder opens an HTTP
long-polling session before upgrading, and those first polling requests carry a
session id only the issuing task knows. Without affinity the handshake fails with
"Session ID unknown" and the client retries forever. The Socket.IO Redis adapter
does not solve this — it fans *broadcasts* across tasks, it does not make a
polling session portable.

The operational consequence: sticky clients do not rebalance onto a
newly-scaled-out task until their cookie expires or their task goes away. Scale-out
relieves *new* sessions faster than existing ones.

---

## 9. Incident basics

### Where the logs are

```bash
terraform output api_log_group_names          # {"api": "...", "migrations": "..."}
terraform output observability_log_group_names
```

| Log group | Contents | Retention (production) |
| --- | --- | --- |
| `/aws/ecs/<project>-<env>/api` | The API container, and the Redis sidecar on profiles that have one | 30 days |
| `/aws/ecs/<project>-<env>/migrations` | The one-off migration task | 30 days |
| `/aws/ecs/containerinsights/<cluster>/performance` | Container Insights events | 30 days |
| `/aws/vpc/<project>-<env>` | VPC flow logs (`vpc_flow_logs_enabled`) | 30 days |

Every group is declared in Terraform rather than left to the `awslogs` driver,
and the execution role deliberately withholds `logs:CreateLogGroup` so the driver
cannot create an unretained one behind their back. A driver-created group never
expires and bills forever.

```bash
aws logs tail /aws/ecs/<project>-<env>/api --follow --since 15m
```

With `NODE_ENV=production` the API emits **one JSON object per line**
(`{"level","context","message","timestamp","requestId"}`). Filter on
`{ $.level = "error" }` and group by `$.context` to find the source; that is the
same pattern the `ApiErrorLogEvents` metric filter uses, and the
`api_error_logs` alarm's description repeats it.

Known gap, stated in `modules/observability/logs.tf`: the filter is a CloudWatch
**JSON** filter, so it only matches lines that parse as JSON. Anything Node
writes before `app.useLogger()` runs, and any uncaught exception's stack trace,
is plain text and will never be counted. Those are startup and crash signals —
the no-healthy-hosts alarm is what covers them.

**Access logs.** One bucket, two writers, one switch: when `access_logs_enabled`
is true — so on `production`, not on `demo` — CloudFront standard logs land in
the shared access-log bucket under `cloudfront/<site>/`, and the ALB delivers
into the same bucket under `alb/` via the `access_logs` block on `aws_lb.api`.
That the bucket lives in the observability module rather than the edge one is
why it can serve both. ELB batches delivery roughly every five minutes, so ALB
per-request data lags an incident by about that much.

### The alarms, and what each one means

All seven exist only when `alarms_enabled` is true, and all of them publish to
the `alerts` SNS topic — which is deliberately *not* the application's
notifications topic. `terraform output alarm_names` prints the set that actually
exists rather than the set you assume.

| Alarm | Fires when | First thing to look at |
| --- | --- | --- |
| `api-no-healthy-hosts` | `HealthyHostCount < 1` | Every request is a 503. Either no tasks, or tasks failing `/api/v1/health/ready`. |
| `api-no-running-tasks` | `RunningTaskCount < 1` (needs Container Insights) | Service events and stopped-task reasons: failed image pull, unresolvable secret, OOM kill. |
| `api-5xx-rate` | >X% of requests are 5xx, counting both target and ELB-generated | Application 500s versus the load balancer answering for a dead target. |
| `api-error-logs` | >N error/fatal lines in five minutes | The log filter above. |
| `database-cpu` | RDS CPU >X% for fifteen minutes | On a `t4g` class, sustained CPU also drains burst credits, after which everything slows at once. |
| `database-free-storage` | Free space below X% of allocated | `STORAGE_FULL` stops writes. Set `database_max_allocated_storage_gb`. |
| `webhook-dlq-depth` | Any message in the payment webhook DLQ | Each one is a webhook never processed. Inspect before redriving — a redrive of a poison message just refills the queue. |

Every alarm sets `treat_missing_data` explicitly, because the default keeps an
alarm in its previous state forever when the metric stops being published — the
exact behaviour you do not want from an alarm whose job is to notice that
something stopped.

### The health check path, and why it matters

The ALB target group health-checks **`/api/v1/health/ready`**, not
`/health/ready`. The application mounts every route under `API_PREFIX` with URI
versioning on top, so the bare path 404s, no target ever turns healthy, and the
service never stabilises. If you point a health check, a smoke test or an uptime
monitor at this API, that prefix is not optional.

`/health/ready` and `/health/live` answer different questions and this is why v0.1
split them:

- **live** — "is the process up?" That is the container health check's question,
  and the right one to kill on.
- **ready** — "can this task serve a request end to end?", which includes
  Postgres and Redis. That is the load balancer's question: a task that cannot
  reach its database should stop receiving traffic *without* being killed,
  because the database coming back should heal it.

The target group polls every 15s with a 5s timeout, needs 2 consecutive passes to
mark a target healthy and 3 failures to mark it unhealthy. The service ignores
health checks for `health_check_grace_period_seconds` (60) after a task reaches
`RUNNING` — image pull happens before `RUNNING`, so that window covers Nest
bootstrap and the first Prisma connection only.

### How to roll back

```bash
gh workflow run deploy.yml -f sha=<earlier-commit-sha>
```

That is the entire procedure, and it works because every image is tagged with the
commit SHA that produced it, so an earlier SHA names exactly one artefact.
`latest` would name whichever build finished last, and "roll back to latest" is
not a sentence.

Four things to know before you rely on it:

1. **The rollback horizon is ten deploys.** The ECR lifecycle policy keeps the
   `image_retention_count` (default `10`) most recently *pushed* images and
   expires the rest. Counting is by push time, so a target older than ten deploys
   may simply not exist. Raise `image_retention_count` if your rollback window is
   longer than a normal week.
2. **It does not roll back the database.** `prisma migrate deploy` is
   forward-only. A rollback re-runs the migration step from the older commit,
   which applies nothing new and leaves the newer schema in place. If a release
   contained a destructive migration, the code rolls back and the schema does
   not — which is why destructive migrations want a two-release expand/contract
   shape, not a rollback plan.
3. **"Stable" is not "deployed".** The service's deployment circuit breaker rolls
   back on its own when new tasks cannot start, and the service then becomes
   perfectly stable — **running the old revision**. `aws ecs wait services-stable`
   returns happily. The deploy workflow compares the live task definition against
   the revision it registered for exactly this reason, and fails with "the
   deployment circuit breaker rolled back… The migration has already been
   applied; the code has not." If you deploy by hand, do the same comparison:

   ```bash
   aws ecs describe-services --cluster <cluster> --services <service> \
     --query 'services[0].taskDefinition'
   ```

4. **Frontends follow.** The workflow rebuilds and republishes both SPAs from the
   rolled-back commit, then invalidates only `/index.html`. `s3 sync` runs
   *without* `--delete`, deliberately — deleting the previous release's hashed
   assets breaks every browser still holding the old `index.html`, and
   CloudFront's 403 → `/index.html` rewrite would answer those requests with HTML
   where a `.js` file is expected. The bucket lifecycle rule does that cleanup
   instead, and the deploy role holds no `s3:DeleteObject` at all, so this cannot
   regress by accident.

### How to drain a task

Draining is already correct by default, and the numbers are chosen rather than
inherited:

- **`deregistration_delay = 60s`.** Not sized from process exit time — the
  container's clean SIGTERM shutdown was measured at ~97 ms idle. It is the
  window in which the load balancer has stopped sending *new* requests to a
  target while existing connections finish. 60s lets the slowest ordinary request
  complete and lets one Socket.IO heartbeat cycle pass, so a websocket client
  closes and re-establishes against a healthy task rather than being cut
  mid-frame. AWS's default is 300s, which adds five minutes to every deploy and
  every scale-in for no benefit this workload can name.
- **`stop_timeout = 30s`.** The grace between SIGTERM and SIGKILL. Fargate caps
  it at 120.

They compose: ECS deregisters the target, waits out the delay, sends SIGTERM, and
allows the stop timeout before SIGKILL. **Worst case ~90 seconds per task.**

```bash
# cycle every task (a rolling replacement, no gap at 100/200)
aws ecs update-service --cluster <cluster> --service <service> --force-new-deployment

# drain one task
aws ecs stop-task --cluster <cluster> --task <task-arn> \
  --reason "draining for <reason>"
```

The ALB's idle timeout is 300s, longer than the application's
`WEBSOCKET_HEARTBEAT_INTERVAL_MS` (60s) — a 60s timeout against a 60s heartbeat
is a race the socket loses, and the symptom is a client that reconnects every
minute for no visible reason.

**You cannot shell into a task.** `enable_execute_command = false` on the
service. Turning it on is one line there *plus* `ssmmessages:CreateControlChannel`,
`CreateDataChannel`, `OpenControlChannel` and `OpenDataChannel` on the **task**
role, which the services module owns. A service with `enable_execute_command` and
no such policy fails to start tasks with a message that names neither. Decide
before an incident, not during one.

### When a migration fails

The deploy workflow runs migrations as a discrete task *before* touching the
service, and gates on the container's exit code. A non-zero exit fails the job
with the previous revision still serving and nothing deployed. The logs are in
the migrations group; the workflow tails the last 15 minutes for you on failure.

Migrations are deliberately not in the container entrypoint — a rolling deploy
would run several concurrently, a failed migration would look exactly like a
failed application boot, and the runtime image does not ship the Prisma CLI at
all. The reasoning is written out in `modules/compute/migrations.tf`.

The migration task always runs on on-demand `FARGATE`, never `FARGATE_SPOT`,
whatever the service runs on: a reclaimed Spot task in the middle of a DDL
statement is the one interruption with no safe retry.

### Mail is not sending

Almost always the same thing. **Every new AWS account starts with SES in the
sandbox**: you can send only to separately verified addresses and domains, the
daily cap is 200 messages and the rate is 1/second. Terraform cannot change it —
verifying a domain proves you own the domain, it does not leave the sandbox.

Getting out is a request you file by hand: AWS console → Amazon SES → Account
dashboard → *Request production access*. AWS reviews it, usually within a day.
Until they approve it, signup and password-reset emails to real users are
rejected, and the only clue is a `MessageRejected` error in the logs.

Also check that the DKIM CNAMEs and the verification token from
`terraform output` were actually published at your registrar. The stack outputs
them rather than creating them, because the hosted zone may not be in this stack.

### A note on the demo profile's Redis

Worth knowing even in a production runbook, because it explains why some code
paths are untested when you first arrive here. On `demo`,
`managed_cache_enabled = false` means Redis is a **per-task sidecar** on
`127.0.0.1` — free, ephemeral, and emptied by every deploy. Two pieces of
`apps/api` are therefore no-ops on that profile: the scheduler's Redis lock
(which exists so N tasks produce one execution) and the Socket.IO Redis adapter
(which fans broadcasts across tasks).

Exercising them takes **two** edits, not one: `managed_cache_enabled = true`
*and* a task ceiling of at least 2. Raising the ceiling alone gives two tasks with
two private sidecars that disagree about who is logged in;
`check "sidecar_cache_across_multiple_tasks"` in `datastores.tf` says exactly that
on plan. The production profile sets both, which is the first time either code
path runs — so if you have only ever run `demo`, production is where the
scheduler lock and the socket adapter get their first real exercise. Watch them.

---

## 10. What this starter deliberately does not do

Discovering an absence during an incident is the expensive way to discover it.
None of the following exists in this repository, and none of it is planned to
appear by accident:

**Topology**

- **No multi-region.** One region, one state key per environment. CloudFront is
  global but its origins are not; there is no Route 53 health-check failover, no
  cross-region replica, no global database. A regional outage is an outage.
- **No blue/green and no canary.** The ECS service states
  `deployment_controller { type = "ECS" }` — a rolling update. `CODE_DEPLOY`
  (blue/green, needs a second target group and a deployment group) and `EXTERNAL`
  are named in `service.tf` and declined as "real answers to questions this stack
  does not have". Traffic shifting, per-header routing and automated canary
  analysis are all absent.
- **No service mesh, no service discovery.** One service behind one ALB. No App
  Mesh, no ECS Service Connect, no Cloud Map, no sidecar proxy, no mTLS between
  services — because there is one service.
- **No staging profile.** Two profiles is not a spectrum. A team wanting Multi-AZ
  RDS without three NAT gateways adds a third profile or overrides individual
  variables, and the second option partly defeats the one-variable property.

**Security and compliance**

- **No compliance posture of any kind.** No AWS Config, no GuardDuty, no Security
  Hub, no dedicated CloudTrail trail, no Access Analyzer, no Inspector. Nothing
  here is evidence for SOC 2, ISO 27001, PCI DSS or HIPAA, and nothing here
  should be cited as such. The stack is built to be *defensible* — least-privilege
  IAM derived statement by statement, security-group references instead of CIDRs,
  encryption everywhere, no long-lived AWS keys — which is a different claim from
  *certified*.
- **No WAF.** See §5.
- **No Shield Advanced**, no DDoS response plan.
- **No customer-managed KMS keys.** AWS-managed keys throughout.
- **No secret rotation automation**, and no Secrets Manager. See §7.
- **No data residency, retention or deletion machinery.** There is no PII
  inventory, no per-user export, no automated erasure. If a regulation applies to
  your data, that work is yours.

**Data**

- **No RDS Proxy, no connection pooler, no read replica.** See §4 and §2.
- **No AWS Backup, no cross-region snapshot copy, no restore drill.**
- **No cache persistence.** Deliberate; see §2.

**Operations**

- **No CloudWatch dashboards.** Seven alarms and a metric filter, no assembled
  view.
- **No tracing.** No X-Ray, no OpenTelemetry, no APM. `requestId` in the
  structured logs is the correlation mechanism, and it stops at the API's
  boundary.
- **No on-call.** Alerting is one SNS topic with one email subscription. No
  PagerDuty, no escalation policy, no schedule, no runbook automation.
- **No load test, no capacity model.** The autoscaling numbers are reasoned, not
  measured.
- **No cost allocation tags activated.** The budget is account-wide and
  unfiltered on purpose — a budget filtered on an inactive tag key reports $0.00
  forever while looking perfectly configured.
- **No IPv6 on the ALB.** The VPC has no IPv6 CIDR, so a dualstack load balancer
  would have nothing to allocate from. (The ALB security group's IPv6 ingress
  rules are harmless and already in place for the day it does.)

---

## 11. Before your first production apply

A checklist, each item traceable to something above.

- [ ] `cost_profile = "production"` **and** an egress decision: `enable_nat = true`,
      or `interface_endpoints = [...]`, or a conscious choice to stay in public
      subnets (§3).
- [ ] `alert_email` set, and **the SNS confirmation email clicked**
      (`terraform output alerts_subscription_notice`).
- [ ] `domain_name` set, and the hosted zone delegated at your registrar —
      certificate validation cannot complete until you do
      (`terraform output edge_hosted_zone_name_servers`). Without it the API is
      served over plain HTTP.
- [ ] `monthly_budget_amount_usd` raised from the `20` default to something that
      reflects this profile, but not so high it never fires.
- [ ] `database_max_allocated_storage_gb` set to a real ceiling (§8).
- [ ] `waf_enabled` set to `false`, or a web ACL actually built and wired (§5).
- [ ] Every `REPLACE_ME` placeholder filled in
      (`terraform output secrets_action_required`).
- [ ] SES production access requested, and the DKIM records published (§9).
- [ ] `github_repository` set, so deployments run through a scoped OIDC role
      rather than a long-lived access key.
- [ ] Read every `check` warning on the plan. `terraform validate` and `tflint`
      do not evaluate them — a green CI build means the configuration is
      well-formed, not that the posture is sensible.
- [ ] Do one restore rehearsal into a throwaway instance (§6) *before* you need
      one.

---

## Related reading

- [`docs/architecture.md`](../architecture.md) — the AWS surface, the request
  lifecycle, and what is deliberately absent.
- [ADR 10 — Two cost profiles and the no-NAT trade-off](../decisions/0010-two-cost-profiles-and-the-no-nat-trade-off.md)
- [ADR 3 — Tokens live in Redis, never in Postgres](../decisions/0003-tokens-in-redis-never-postgres.md)
- [`infra/terraform/README.md`](../../infra/terraform/README.md) — running the
  stack, the module map, destroying it.
- [`docs/guides/container.md`](./container.md) — the image the service runs.
- [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml) — the
  deployment, end to end, with the rollback command at the top.
