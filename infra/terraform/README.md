# Terraform

The whole AWS stack: a VPC, PostgreSQL on RDS, Redis, an ECS Fargate service
behind an ALB, two static frontends on CloudFront, the queues and buckets the
API talks to, alarms and a cost budget, and a GitHub OIDC role to deploy it all.
One `terraform apply` from a machine with credentials.

Two stacks, run in this order:

| Stack       | Path                         | State | How often            |
| ----------- | ---------------------------- | ----- | -------------------- |
| `bootstrap` | `infra/terraform/bootstrap/` | local | once per AWS account |
| root        | `infra/terraform/`           | S3    | every change         |

The bootstrap stack creates the S3 bucket the root stack stores its state in.
It cannot store its own state there — hence local state, which is gitignored
and disposable.

> Nothing in this repository contains real AWS account ids, credentials,
> profile names or domains. Every value in a `*.example` file is a placeholder;
> your real ones go in `terraform.tfvars` / `backend.hcl`, both gitignored.

## Requirements

- Terraform `~> 1.15` (floor is 1.10 — see "State locking" below)
- AWS credentials with permission to create the resources in scope
- `.terraform.lock.hcl` is committed; run `terraform init` without
  `-upgrade` to get exactly the pinned provider versions

## 1. Bootstrap, once

```bash
cd infra/terraform/bootstrap
cp terraform.tfvars.example terraform.tfvars   # edit
terraform init
terraform apply
```

Creates one bucket: versioned, encrypted (SSE-S3), all public access blocked,
ACLs disabled, TLS-only via bucket policy, with lifecycle rules that expire
superseded state versions and abandoned multipart uploads. Its name is
`<project_name>-tfstate-<account_id>` — S3 bucket names are globally unique, so
the account id is what keeps forks of this repository from colliding.

Copy the `backend_config` output into the root stack's `backend.hcl`.

### State locking

Native S3 locking (`use_lockfile = true`), added in Terraform 1.10: a `.tflock`
object is written next to the state file and removed on release. **There is no
DynamoDB table in this repository.** Practically every guide written before 2025
tells you to create one; that path still works but is legacy, costs money, and
is one more resource to leave behind. Don't add one.

## 2. Root stack, every change

```bash
cd infra/terraform
cp backend.hcl.example backend.hcl             # edit: bucket + key + region
cp terraform.tfvars.example terraform.tfvars   # edit
terraform init -backend-config=backend.hcl
terraform plan
terraform apply
```

One state key per environment (`dev/terraform.tfstate`,
`prod/terraform.tfstate`, …) in the one bucket. Switching environments means
re-running `init` with a different `key`.

### After the first apply

Three things Terraform cannot do for you, each surfaced as an output rather
than as a line in a document that goes stale:

```bash
terraform output secrets_action_required      # OAuth + Stripe credentials to fill in
terraform output alerts_subscription_notice   # confirm the SNS subscription AWS emailed you
terraform output github_actions_setup         # `gh` commands to wire up deployments
```

With `domain_name` set, add `edge_hosted_zone_name_servers` to the two
non-obvious ones: certificate validation cannot complete until you delegate to
those name servers at your registrar, and `ses_verification_token` /
`ses_dkim_tokens` have to be published before mail sends.

## Modules

The root files are the wiring. Each one resolves every input from
`local.profile` and `local.names`, calls one module, and re-exports what the
other stacks and the deploy workflow need. Nothing below a module boundary ever
sees `var.cost_profile`.

| Root file          | Module                  | What it creates                                                                    |
| ------------------ | ----------------------- | ---------------------------------------------------------------------------------- |
| `network.tf`       | `modules/network`       | VPC, subnets, route tables, the security-group chain, optional NAT and VPC endpoints, flow logs |
| `datastores.tf`    | `modules/data`          | RDS PostgreSQL, ElastiCache **or** a Redis sidecar contract, every SSM parameter the API boots with |
| `services.tf`      | `modules/services`      | Uploads bucket, payment webhook queue + DLQ, notification topic, SES identity, the two ECS task roles |
| `compute.tf`       | `modules/compute`       | ECR, the ECS cluster, the API service, the ALB, the one-off migration task, autoscaling |
| `edge.tf`          | `modules/edge`          | Two private S3 site buckets + CloudFront distributions (OAC), ACM, Route 53, optional distribution in front of the ALB |
| `observability.tf` | `modules/observability` | Log retention, an API error metric, alarms, the alert topic, the access-log bucket, the monthly budget |
| `cicd.tf`          | `modules/cicd`          | GitHub OIDC provider + deploy role, and one SSM parameter holding everything the deploy workflow reads |

Each module has its own README with the reasoning that did not fit in a
comment — start with `modules/data/README.md` (why a Redis sidecar, why not
Aurora Serverless) and `modules/services/README.md` (the least-privilege IAM
audit, statement by statement).

Shared files: `locals.tf` (cost profiles + every name), `variables.tf` (the
inputs common to the whole stack), `providers.tf`, `versions.tf`, `backend.tf`,
`data.tf` (account/region/AZ lookups), `outputs.tf` (identity and the resolved
profile), `checks.tf` (stack-wide preflight warnings). Module-specific
variables, checks and outputs live in the root file that wires that module, not
in the shared ones.

## Cost profiles

`cost_profile` is the single knob that picks the posture of the entire stack.
Both profiles run the *same* code: the difference is entirely the two maps in
`local.profile_settings` (`locals.tf`), and modules read `local.profile.<key>`.

- **`demo`** — the cheapest thing that runs end to end, and disposable with it.
  Roughly **$15-25/month**, dominated by RDS, the ALB and one Fargate task.
- **`production`** — managed and durable. Substantially more: NAT egress alone
  is ~$32/month per gateway and this profile runs one per AZ.

What actually differs:

| Key                                     | `demo`               | `production`         | Why it matters                                            |
| --------------------------------------- | -------------------- | -------------------- | --------------------------------------------------------- |
| `az_count`                              | 2                    | 3                    | 2 is the floor — ALB and RDS subnet groups both need it     |
| `private_subnets_enabled`               | `false`              | `true`               | Free either way; where workloads sit                        |
| `nat_gateway_enabled` / `_count`        | `false` / 0          | `true` / 3           | ~$32/month **per gateway**, the largest fixed cost here     |
| `vpc_endpoints_enabled`                 | `false`              | `true`               | ~$7/month per endpoint per AZ; still opt-in by name         |
| `vpc_flow_logs_enabled`                 | `false`              | `true`               | Billed on ingestion and storage                             |
| `managed_cache_enabled`                 | `false` (sidecar)    | `true` (ElastiCache) | ~$12/month per node — see "Running on more than one task"   |
| `database_instance_class`               | `db.t4g.micro`       | `db.t4g.small`       | ~$12 vs ~$24/month                                          |
| `database_allocated_storage_gb`         | 20                   | 50                   | gp3, ~$0.115/GB-month                                       |
| `database_multi_az`                     | `false`              | `true`               | Roughly doubles the instance cost                           |
| `database_backup_retention_days`        | 1                    | 14                   | Backups up to the database size are free                    |
| `database_performance_insights`         | `false`              | `true`               | Free at 7-day retention                                     |
| `cache_node_type` / `cache_replica_count` | `cache.t4g.micro` / 0 | `cache.t4g.small` / 1 | Only read when `managed_cache_enabled`                   |
| `compute_use_fargate_spot`              | `true`               | `false`              | ~70% off, interruptible                                     |
| `compute_task_cpu` / `_memory`          | 256 / 512            | 512 / 1024           | Fargate bills per vCPU-second and GB-second                 |
| `compute_desired_count`                 | 1                    | 2                    | One task means no rolling deploy without a gap              |
| `compute_autoscaling`, `_min`, `_max`   | off, 1, 1            | on, 2, 6             | The ceiling is what the cache and the checks key off        |
| `waf_enabled`                           | `false`              | `false`              | The one key that is equal on both profiles — **see below**   |
| `cloudfront_price_class`                | `PriceClass_100`     | `PriceClass_All`     | Which edge locations serve traffic                          |
| `access_logs_enabled`                   | `false`              | `true`               | Creates the shared log bucket; CloudFront **and** the ALB deliver into it |
| `log_retention_days`                    | 7                    | 30                   | Every log group in the stack                                |
| `container_insights`                    | `false`              | `true`               | Billed as custom metrics                                    |
| `alarms_enabled`                        | `false`              | `true`               | A demo stack has nobody on call                             |
| `deletion_protection`                   | `false`              | `true`               | `terraform destroy` fails on the database when true         |
| `force_destroy_bucket`                  | `true`               | `false`              | Whether a non-empty bucket blocks destroy                   |
| `skip_final_snapshot`                   | `true`               | `false`              | A final snapshot outlives the stack, and is billed          |
| `custom_domain_expected`                | `false`              | `true`               | Drives the `custom_domain` warning in `checks.tf`           |

A knob that differs between the two postures is a new key in **both** maps,
never an `if` inside a module. That rule is what keeps this one codebase
instead of two.

`cost_profile = "production"` requires `alert_email`: production alarms with
nowhere to go are worse than no alarms. Hard requirements like that live in
variable `validation` blocks and fail the plan. Softer "you probably didn't mean
this" cases are `check` blocks — in `checks.tf` when they are stack-wide, and
beside the module they concern otherwise — and warn on plan without failing it.

### Running on more than one task

The demo profile deliberately runs **one** task with a **free Redis sidecar**,
and that combination is the cheapest one that works. It is also the one
combination where two pieces of `apps/api` are never exercised: the scheduler's
Redis lock (which exists so N tasks produce one execution) and the Socket.IO
Redis adapter (which fans broadcasts across tasks). Both are no-ops at a single
task.

Proving they work on real infrastructure takes **two** edits to the `demo` map,
not one:

```hcl
managed_cache_enabled = true   # shared ElastiCache, ~$12/month for cache.t4g.micro
compute_min_capacity  = 2      # second Fargate Spot task, ~$3/month
compute_max_capacity  = 2
```

Roughly **$15/month on top of the demo baseline**, and reversible — set them
back afterwards and the replication group and the second task go away.

Raising the capacity **alone** does not work and is not silently corrected. A
Redis sidecar is per task, so two tasks would each get their own and share
nothing: the refresh-token allowlist would disagree about who is logged in,
scheduled jobs would run once per task, and websocket broadcasts would reach
only the task that emitted them. The `sidecar_cache_across_multiple_tasks`
check in `datastores.tf` says exactly that on plan.

The reverse used to happen automatically — `managed_cache_enabled` was derived
from `compute_max_capacity > 1`, so raising the task count quietly added ~$12/month,
about 40% of the demo stack's bill, to a stack whose author had edited a
capacity number. Two independent things now have two keys.

### Access logs

`access_logs_enabled` creates one bucket (`local.names.logs_bucket`, owned by
the observability module) and turns on both writers:

| Prefix                | Written by | Mechanism |
| --------------------- | ---------- | --------- |
| `cloudfront/<site>/`  | The two SPA distributions | An ACL grant to the `awslogsdelivery` canonical user — which is why this is the one bucket in the stack with ACLs enabled |
| `alb/AWSLogs/<account-id>/elasticloadbalancing/<region>/` | The API load balancer | A bucket **policy** naming the AWS identity that delivers |

Which identity that is depends on the Region, and Terraform cannot work it out:
Regions launched **before August 2022** deliver as a per-Region ELB account that
`data.aws_elb_service_account` resolves; Regions launched **from August 2022
onward** deliver as `logdelivery.elasticloadbalancing.amazonaws.com`. The policy
always grants the service principal; the account statement is behind
`alb_log_delivery_uses_regional_account`, which defaults to `true` because the
default `aws_region` — and most likely yours — is an older Region. Flip it to
`false` in a newer one, where the data source has no entry and would fail the
plan.

**None of this is verifiable from a plan.** ELB checks the policy by writing a
test object while the load balancer is being created; a wrong policy surfaces as
an apply-time `Access Denied for bucket` and nothing earlier. Delivery is also
batched roughly every five minutes, so an empty prefix right after an apply is
normal.

### What this stack does not create

**No WAF.** No module here creates a web ACL, so `waf_enabled` is `false` on
**both** profiles — it is the only key in the two maps that does not differ, and
it is false rather than absent so the `edge_supporting_resources` check in
`edge.tf` still has something to warn on if anyone flips it.

It used to be `true` on production, which was wrong twice over: nothing was
created, and the input it fed (`local.edge_web_acl_arn`) is `CLOUDFRONT`-scoped,
so the most it could ever have covered is the two static SPA distributions —
content-hashed Vite output behind Origin Access Control. The tier that earns a
WAF is the API behind the ALB, which needs a **`REGIONAL`** web ACL in this
stack's own region, associated with `aws_wafv2_web_acl_association`. Different
scope, different region, different resource.

Both paths, what each costs and which managed rule groups to start from are in
[`docs/guides/production.md`](../../docs/guides/production.md) §5. Building the
module is a roadmap item, not something this README should half-specify.

## Variables

Every variable is documented on its own `variable` block. Shared inputs are in
`variables.tf`; the rest are declared in the root file that wires the module
they configure, so a variable and its only consumer stay in the same file.

| Variable                            | Default             | File               |
| ----------------------------------- | ------------------- | ------------------ |
| `project_name`                      | `nest-aws-starter`  | `variables.tf`     |
| `environment`                       | `dev`               | `variables.tf`     |
| `aws_region`                        | `us-east-1`         | `variables.tf`     |
| `profile`                           | `null`              | `variables.tf`     |
| `cost_profile`                      | `demo`              | `variables.tf`     |
| `domain_name`                       | `null`              | `variables.tf`     |
| `alert_email`                       | `null`              | `variables.tf`     |
| `vpc_cidr`                          | `10.0.0.0/16`       | `network.tf`       |
| `enable_nat`                        | `false`             | `network.tf`       |
| `interface_endpoints`               | `[]`                | `network.tf`       |
| `database_name`                     | `starter`           | `datastores.tf`    |
| `database_username`                 | `appuser`           | `datastores.tf`    |
| `database_engine_version`           | `18`                | `datastores.tf`    |
| `database_connection_limit`         | `10`                | `datastores.tf`    |
| `database_max_allocated_storage_gb` | `0` (no autoscale)  | `datastores.tf`    |
| `cors_allowed_origins`              | `[]` (use the edge) | `services.tf`      |
| `api_image_tag`                     | `latest`            | `compute.tf`       |
| `migrations_image_tag`              | `migrations`        | `compute.tf`       |
| `api_extra_environment`             | `{}`                | `compute.tf`       |
| `monthly_budget_amount_usd`         | `20`                | `observability.tf` |
| `alb_log_delivery_uses_regional_account` | `true`         | `observability.tf` |
| `github_repository`                 | `null` (no CI/CD)   | `cicd.tf`          |
| `github_deploy_ref`                 | `refs/heads/main`   | `cicd.tf`          |
| `create_github_oidc_provider`       | `true`              | `cicd.tf`          |

Two defaults are worth reading before the first apply. `enable_nat = false` is
what keeps a demo stack under ~$25/month, and `github_repository = null` means
no OIDC role exists — which is the right posture for a stack deployed from a
laptop and the wrong one for anything that deploys itself, because the
alternative to a scoped OIDC role is a permanent access key in a public
repository's settings.

## Naming

Nothing is hand-named. `local.name_prefix` is `<project_name>-<environment>`,
and every resource name is a key in `local.names` (`locals.tf`). The root files
reshape that flat map into whatever object a module's `names` variable declares;
none of them build a name out of the prefix themselves.

The rule runs both ways: adding a resource means adding a key there first, and
a key with no resource behind it comes back out. A name for something that does
not exist reads exactly like a name for something that does.

Watch the inline notes about AWS length limits — ELBv2 names cap at 32
characters and ElastiCache at 40, so those keys are wrapped in `substr()`. A
long `project_name` plus a long `environment` will overflow them.

`terraform output resource_names` prints the resolved set.

Tagging is handled once, in the provider's `default_tags`: `Project`,
`Environment`, `ManagedBy = terraform`, `CostProfile` land on every taggable
resource in every module. Modules add only resource-specific tags.

## Destroying the stack

```bash
terraform destroy
```

On the **demo** profile this is meant to work first time, and the profile is
built for it: `deletion_protection = false`, `skip_final_snapshot = true`, and
`force_destroy_bucket = true` so the site, uploads and log buckets are emptied
rather than blocking on their contents. ECR repositories are force-deleted with
their images for the same reason.

On the **production** profile it is meant *not* to. `deletion_protection = true`
makes the RDS instance refuse to be destroyed, and it will refuse until someone
turns that off deliberately; `skip_final_snapshot = false` means deleting it
anyway still leaves a final snapshot behind, which is billed as storage and is
not managed by this stack. `force_destroy_bucket = false` means a non-empty
bucket stops the destroy. All three are the intended behaviour: they are what
makes "durable" mean something.

Left behind on any profile, and worth checking afterwards:

- **The bootstrap bucket and your state file.** They are a separate stack, and
  destroying the root stack has to leave them. Empty and delete them by hand,
  last.
- **The final RDS snapshot**, on any profile with `skip_final_snapshot = false`.
- **CloudWatch log group data** inside its retention window, and any log group
  AWS created itself rather than Terraform.
- **The IAM OIDC provider**, when `create_github_oidc_provider = false` — the
  stack adopted it, so it does not delete it.
- **Route 53 hosted zone charges** if you keep the zone.

CloudFront is the slow part: disabling and deleting a distribution takes
15+ minutes each, and `terraform destroy` waits for it.

The cost budget is created on every profile and is not gated on anything,
precisely because the failure mode this stage introduces is not an application
error — it is a stack still running next month. If `alert_email` is unset, the
budget notifies nobody; set it.

## Checks

Both stacks must stay clean. This is exactly what `.github/workflows/infra.yml`
runs on every change under `infra/**`:

```bash
terraform fmt -check -recursive -diff infra/terraform

terraform -chdir=infra/terraform init -backend=false && \
  terraform -chdir=infra/terraform validate

terraform -chdir=infra/terraform/bootstrap init -backend=false && \
  terraform -chdir=infra/terraform/bootstrap validate

tflint --chdir=infra/terraform --recursive
tflint --chdir=infra/terraform --var 'cost_profile=demo'
tflint --chdir=infra/terraform --var 'cost_profile=production'
```

`validate` and `tflint` need no credentials; `plan` does. The two `--var` runs
are separate from the `--recursive` one on purpose: `cost_profile` is declared
only in the root stack, so passing it while descending into the modules fails in
every module — which is the point, since no module can see it.

Neither `validate` nor `tflint` evaluates a `check` block; those only run on
`plan` and `apply`. A green CI build means the configuration is well-formed, not
that the posture is sensible — read the warnings on your first plan.
