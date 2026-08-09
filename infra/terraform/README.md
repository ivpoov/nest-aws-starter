# Terraform

Two stacks, run in this order:

| Stack       | Path                          | State    | How often                |
| ----------- | ----------------------------- | -------- | ------------------------ |
| `bootstrap` | `infra/terraform/bootstrap/`  | local    | once per AWS account     |
| root        | `infra/terraform/`            | S3       | every change             |

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

As of this PR the root stack declares no resources. Modules (network, data,
compute, services, edge, observability, ci/cd) land in the PRs that follow.

## Cost profiles

`cost_profile` is the single knob that picks the posture of the entire stack:

- **`demo`** — cheapest thing that runs end to end and is meant to be thrown
  away: no NAT gateway, two AZs, smallest instance classes, Fargate Spot,
  7-day logs, no deletion protection, no WAF, no alarms.
- **`production`** — managed and durable: NAT per AZ, three AZs, multi-AZ
  database with 14-day backups, autoscaling on demand-priced Fargate, WAF,
  alarms, deletion protection.

Both profiles run the *same* code. The difference is entirely in
`local.profile_settings` in `locals.tf`, and modules read
`local.profile.<key>` — no module compares `var.cost_profile` itself. A knob
that differs between the two postures is a new key in **both** maps, never an
`if` inside a module. That rule is what keeps this one codebase instead of two.

Setting `cost_profile = "production"` requires `alert_email`: production alarms
with nowhere to go are worse than no alarms. Softer "you probably didn't mean
this" cases live in `checks.tf` as `check` blocks, which warn on plan instead of
failing it.

## Naming

Nothing is hand-named. `local.name_prefix` is `<project_name>-<environment>`,
and every resource name is a key in `local.names` (`locals.tf`). Adding a
resource means adding its name there first. Watch the inline notes about AWS
length limits — ELBv2 names cap at 32 characters and ElastiCache at 40, so
those keys are wrapped in `substr()`.

Tagging is handled once, in the provider's `default_tags`: `Project`,
`Environment`, `ManagedBy = terraform`, `CostProfile` land on every taggable
resource in every module. Modules add only resource-specific tags.

## Checks

Both stacks must stay clean:

```bash
terraform fmt -check -recursive infra/terraform
terraform -chdir=infra/terraform/bootstrap init -backend=false && \
  terraform -chdir=infra/terraform/bootstrap validate
terraform -chdir=infra/terraform init -backend=false && \
  terraform -chdir=infra/terraform validate
```

`validate` needs no credentials. `plan` does.

Linting, if you have it installed:

```bash
tflint --chdir=infra/terraform --recursive
```
