# Compute module

The registry, the cluster, the API service and the load balancer in front of it,
the one-off migration task, and autoscaling. Wired from
`infra/terraform/compute.tf`, which resolves every input from `local.profile`,
`local.names` and the network, data, services and edge modules' outputs — this
module never sees `var.cost_profile`.

```
                    ┌─────────────────────────────────────────────┐
  internet ─443──▶  │ ALB   public subnets, ACM, /health/ready     │
           ─80───▶  │       301 → 443, or forward (TEST ONLY)      │
                    └───────────────────┬─────────────────────────┘
                                        │ target group, ip targets
                                        ▼
                    ┌─────────────────────────────────────────────┐
                    │ ECS service   rolling, circuit breaker + rollback
                    │   task ─┬─ api      ECR image, secrets from SSM
                    │         └─ redis    sidecar, only when there is no
                    │                     managed cache (data module)
                    └─────────────────────────────────────────────┘
                                        │
     one-off, before every service update
                    ┌─────────────────────────────────────────────┐
                    │ migrations task    same repo, `migrations` tag
                    └─────────────────────────────────────────────┘
```

## What is deliberately not here

**IAM.** Both task roles come from the services module, which derived every
statement in them from a call site in `apps/api`. This module creates no role and
no policy.

**`REDIS_URL`.** The data module ships it inside `container_secrets`, pointing at
either the managed cache or `127.0.0.1` depending on which one exists. Setting it
here would override the module that knows the answer.

**The sidecar's image and command.** `var.cache_sidecar` is the data module's
output passed through untouched. When a managed cache appears the value becomes
`null` and the container disappears from the task definition with no edit here.

**A web repository.** `apps/web` and `apps/admin` are static Vite builds served
from S3 through CloudFront. There is no web container.

## Migrations run *before* the service update, never in the entrypoint

`prisma migrate deploy && node dist/main.js` in the container command is the
shortcut, and it is wrong three times over: a rolling deploy runs it
concurrently from every starting task, a failure is indistinguishable from a
failed boot, and it forces the Prisma CLI (250 MB of engines that
`apps/api/Dockerfile` deliberately drops) back into every running task forever.

So Terraform defines the task definition and the deploy workflow runs it as a
discrete, blocking step, failing the deployment on a non-zero exit code before
`update-service` is called. The exact sequence — with the commands — is the
`migration_task_contract` output, surfaced at the root as `deploy_contract`.

Two consequences worth stating out loud:

- **The migration image is a different tag in the same repository.** The runtime
  image cannot run migrations; the workflow builds the Dockerfile's `build`
  target as well and pushes it as `:migrations`.
- **Migrations must be backward compatible for the length of one deploy.**
  Between the migration finishing and the last old task draining, the previous
  code is running against the new schema.

## The numbers, and why

| Setting | Value | Why |
| --- | --- | --- |
| `deregistration_delay` | 60 s | Not process exit time (~97 ms measured in PR 7) — the window in which in-flight requests and Socket.IO connections finish after the target stops receiving new ones. AWS defaults to 300 s, which adds five minutes to every deploy for no benefit here. |
| `stopTimeout` | 30 s | SIGTERM to SIGKILL. Sized for the slowest in-flight request, not for the idle case. |
| `health_check_grace_period` | 60 s | Nest bootstrap plus the first Prisma connection. Image pull is not included — it happens before the task reaches RUNNING. |
| health check path | `/api/v1/health/ready` | Readiness, not liveness: the load balancer's question includes Postgres and Redis. A task that cannot reach its database should stop receiving traffic without being killed. |
| `idle_timeout` | 300 s | Must exceed `WEBSOCKET_HEARTBEAT_INTERVAL_MS` (60 s), or the ALB closes live sockets between heartbeats. |
| stickiness | on | `socket.io-client` defaults to `["polling", "websocket"]`, and a polling handshake is only valid against the task that issued it. The Redis adapter fans out broadcasts; it does not make a session portable. |
| deployment | 100% / 200%, circuit breaker + rollback | Start the replacement before stopping the incumbent, and give up (and roll back) on a task definition that cannot start, instead of retrying forever behind a green workflow. |
| access logs | on when the caller passes a bucket | The only record of what the load balancer itself saw — a 502 from a target that never became healthy, a 4xx the ALB answered alone, a failed TLS negotiation. The bucket and its delivery policy belong to the observability module; this module only names where to write. |
| ECR lifecycle | untagged after 1 day, then keep 10 | Untagged images are the leak: re-pushing a tag orphans its predecessor's layers and nothing in AWS ever reclaims them. |

## `assign_public_ip`

True whenever the network module put the tasks in public subnets — which is the
direct consequence of that profile having no NAT gateway. A Fargate task must
reach ECR, CloudWatch Logs and SSM, and there are exactly three ways to do it: a
NAT gateway (~$32/month each), interface endpoints (~$7/month each per AZ), or a
public address on the task (free).

It is not exposure. The API security group admits the load balancer's group on
one port and nothing else, and no ingress rule anywhere references a CIDR. The
root stack raises a `check` when the tasks are private *and* neither egress path
exists, because that combination fails at image pull with an error that names
none of this.

## Autoscaling is not only a cost knob

Target tracking on CPU, off unless the profile enables it. The reason it matters
beyond the bill: the scheduler takes a Redis lock so that N tasks produce one
execution, and the Socket.IO Redis adapter fans broadcasts across tasks. Both are
no-ops at a single task, so a stack whose ceiling is one never runs either code
path until it is too late to find out. Raising `max_capacity` above one turns
them on — and is also what makes the data module require a shared cache instead
of a task-local sidecar.
