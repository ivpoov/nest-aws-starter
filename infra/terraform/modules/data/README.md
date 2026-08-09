# Data module

PostgreSQL on RDS, Redis, and every secret the API boots with. Wired from
`infra/terraform/datastores.tf`, which resolves every input from `local.profile`,
`local.names` and the network module's outputs — this module never sees
`var.cost_profile`.

```
                    ┌──────────────────────────────────────────┐
   API task ─5432──▶│ RDS PostgreSQL  private, encrypted, gp3   │
        │           └──────────────────────────────────────────┘
        │
        ├─6379──▶ redis://127.0.0.1   sidecar container, one task    (max 1 task)
        └─6379──▶ rediss://…          ElastiCache replication group  (max >1 task)

   SSM Parameter Store  /<project>/<env>/AUTH_JWT_SECRET, DATABASE_URL,
                        REDIS_URL, and the third-party placeholders
```

Placement comes from `module.network.workload_subnet_ids`: the private tier
where it exists, the public one otherwise. Nothing here picks a subnet, and
nothing here branches on the profile to do it. Reachability is the security
groups' job either way — `publicly_accessible = false`, and the database group
admits only the API task group.

## Redis: a sidecar in demo, ElastiCache in production

Most "cheap AWS" guides reach for ElastiCache Serverless here, and it is the one
choice that quietly wrecks a disposable stack. Serverless bills a **minimum of
1 GB of stored data at ~$0.084/GB-hour — about $61/month** before a single ECPU
is charged. That is more than the rest of a demo stack put together, for a cache
whose entire contents are regenerated on demand.

So the small stack does not get one. Redis runs as a second container in the same
ECS task (`redis:8-alpine`), reachable on `127.0.0.1` because `awsvpc` gives the
containers in a task one network namespace. It costs nothing beyond the task that
was already running, and **no ElastiCache resource is created at all**.

**The application does not change between the two.** `apps/api` resolves
`REDIS_URL` through the provider abstraction added in v0.1 (`RedisProvider` →
`ioredis`) and never asks where the server is. `redis://127.0.0.1:6379` and
`rediss://<primary>.cache.amazonaws.com:6379` are the same code path with two
strings — the extra `s` is what turns TLS on. That abstraction has been carrying
a small cost since v0.1; this is the invoice it pays.

The switch is `managed_cache_enabled`, and the caller derives it from the ceiling
on the task count rather than from the profile name, because that is the actual
rule: **a task-local cache is correct exactly while there is one task.** Two tasks
with two sidecars would disagree about who is logged in — the refresh-token
allowlist lives in Redis.

Stated plainly, the sidecar's cost: it is ephemeral. Every deploy, task
replacement and crash empties it, and that signs every user out. Rate-limit
counters and cached reads reset with it. For a demo that is the correct trade;
for anything else, raise the task ceiling and get a replication group.

| | sidecar | ElastiCache replication group |
| --- | --- | --- |
| Cost | $0 beyond the task | ~$12/month for `cache.t4g.micro`, per node |
| Survives a deploy | no | yes |
| Shared between tasks | no | yes |
| Encryption in transit | n/a (loopback) | yes, `rediss://` |

`cache_sidecar` is the output that carries this across the module boundary — the
compute stack consumes it instead of hardcoding an image, so when it becomes
`null` the container disappears from the task definition with no other edit.

## Why not Aurora Serverless v2

Aurora Serverless v2 is the better database and the wrong default here. It bills
per ACU-hour at **~$0.12/ACU-hour, and the smallest steady-state configuration is
0.5 ACU — about $44/month** before storage and I/O, against roughly $12/month for
`db.t4g.micro` plus ~$2/month for 20 GB of gp3.

Scale-to-zero (Aurora PostgreSQL 16.3+ with `min_capacity = 0`) drops idle compute
to nothing and changes that arithmetic considerably, at the price of a ~15 second
cold start on the first query after a pause — which is a poor first impression for
a demo someone opens once a week.

Switch when the workload earns it: bursty or spiky traffic, a working set that
outgrows a t4g class, or a need for fast cloning and 15-minute cross-region
recovery. Then it is `aws_rds_cluster` + `aws_rds_cluster_instance` with a
`serverlessv2_scaling_configuration` block, and this module's SSM parameter
assembly is unchanged — `DATABASE_URL` is built from whatever endpoint attribute
the resource exposes.

All prices are us-east-1 on-demand at the time of writing. Check the pricing pages
before quoting them.

## Secrets

Every secret is an SSM Parameter Store `SecureString` under
`local.secret_prefix` (`/<project>/<environment>`), one parameter per environment
variable. The ECS task and execution roles created by the services module are
already scoped to that path, so nothing here grants IAM.

SSM rather than Secrets Manager, for two reasons: Standard-tier parameters are
free where Secrets Manager is $0.40 per secret per month, and ECS resolves a task
definition's `secrets` block one parameter per environment variable — a single
JSON blob would have to be fetched and split by the application, which means the
application needs AWS credentials before it can read its own configuration.

Encryption uses the AWS-managed `alias/aws/ssm` key, which is free and needs no
extra `kms:Decrypt` grant. A customer-managed key would require adding one to
both task roles, which the services module owns.

### What Terraform generates

- **`AUTH_JWT_SECRET`** — `random_bytes` with `length = 48`, rendered as 96 hex
  characters. The API's production boot guard does not check length; it scores
  `period × ceil(log2(distinct characters))` and demands 256 bits, so a long
  repetitive string scores near zero. 96 hex characters score 96 × 4 = **384
  bits**, on every draw — the guard's own suggestion, `openssl rand -hex 48`,
  produces exactly this shape. (`openssl rand -base64 32` is 44 characters and
  fails the same guard about 97% of the time, which is why it is not what this
  generates.)
- **`DATABASE_URL`** — assembled from the instance's own `address`, the generated
  master password, and the configured name, port and pool size. Never typed out,
  so it cannot drift from the database it points at. `sslmode=require` is what
  makes `rds.force_ssl` in the parameter group a working setting rather than a
  connection failure at first boot.
- **`REDIS_URL`** — the one string that differs between the two cache shapes.

Neither the master password nor the JWT secret is an output. They exist in
Terraform state and in the encrypted parameters, and nowhere else; no value is
written to a file in this repository.

### What Terraform cannot know

OAuth client secrets and Stripe keys exist only once a human has registered the
application with Google, Meta, Discord or Stripe. Terraform creates the
parameters — so the compute stack can reference them without a
`ParameterNotFound` at task start — fills them with the sentinel `REPLACE_ME`,
and then **ignores changes to the value forever**. Fill one in with
`aws ssm put-parameter --overwrite` and no later apply resets it.

The reminder is the **`placeholders_notice` output** (surfaced at the root as
`secrets_action_required`), which prints the exact `aws ssm put-parameter` command
for each one, with a note on where the real value comes from. It is an output
rather than a comment because a comment in a `.tf` file is not a reminder.

## What costs money

| Thing | Cost | Default |
| --- | --- | --- |
| RDS `db.t4g.micro`, single-AZ | ~$12/month | always created |
| 20 GB gp3 storage | ~$2.30/month | always created |
| Backups up to the size of the database | free | 1 day demo, 14 days production |
| Multi-AZ standby | roughly doubles the instance cost | production only |
| Performance Insights, 7-day retention | free | production only |
| ElastiCache `cache.t4g.micro` | ~$12/month per node | production only |
| Redis sidecar container | $0 | demo only |
| SSM Standard parameters | free | always created |

## Inputs and outputs

Inputs are documented on each `variable` block in `variables.tf`; outputs on each
`output` block in `outputs.tf`. The three the compute stack cares about are
`container_secrets` (environment variable name → parameter ARN, shaped for a task
definition's `secrets` block), `cache_sidecar` (the Redis container to add, or
`null`), and `managed_cache_enabled`.
