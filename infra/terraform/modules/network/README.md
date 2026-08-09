# Network module

VPC, subnets, routing, the security-group chain, and the S3 gateway endpoint.
Wired from `infra/terraform/network.tf`, which resolves every input from
`local.profile` and `local.names` — this module never sees `var.cost_profile`.

## Topology

```
                     internet
                        │
                    ┌───▼───┐
                    │  IGW  │
                    └───┬───┘
  ┌─────────────────────┴─────────────────────┐
  │ public subnet /24 per AZ  (all profiles)  │  ALB, and the API task in demo
  └─────────────────────┬─────────────────────┘
                        │  NAT gateway, only if enable_nat
  ┌─────────────────────┴─────────────────────┐
  │ private subnet /24 per AZ  (production)   │  API task, database, cache
  └───────────────────────────────────────────┘
                        │
                  S3 gateway endpoint (free, both tiers)
```

Subnets are `/24`s carved from the VPC block: public at offsets 0…n-1, private
at 10…10+n-1. The gap leaves room for an isolated tier at 20+ without
renumbering.

The public route table is shared; private route tables are one per AZ, so a NAT
gateway per zone never becomes a cross-AZ dependency.

## Security groups

```
internet ──80/443──▶ ALB ──api port──▶ API task ──5432──▶ database
                                               ╰──6379──▶ cache
```

- Only the ALB group accepts a CIDR from the internet. Every other rule between
  tiers references the source security group, not an address range.
- API egress is enumerated (443 anywhere, DNS to the VPC resolver, NTP to the
  Amazon Time Sync address, and the two data ports) rather than left open to
  everything. Widen it deliberately if the app calls something on another port.
- The database and cache groups have no egress rules at all: managed services
  answer connections, they do not open them.
- The VPC's default security group is stripped of its rules.

## What costs money

| Thing                    | Cost                                       | Default          |
| ------------------------ | ------------------------------------------ | ---------------- |
| VPC, subnets, IGW, RTs   | free                                        | always created   |
| S3 gateway endpoint      | free                                        | always created   |
| NAT gateway              | ~$32/month each + data processing           | **off** (`enable_nat`) |
| Interface endpoint       | ~$7/month per endpoint per AZ + processing  | **off** (`interface_endpoints`) |
| VPC flow logs            | CloudWatch ingestion + storage              | off in demo, on in production |

The demo profile cannot create a NAT gateway: it creates no private subnets, so
`nat_gateway_count` clamps to zero no matter what `enable_nat` is set to. That
is the point — the single most common way a "cheap test stack" runs up a bill is
a NAT gateway nobody remembers asking for.

Without NAT, private subnets are not useless: they reach the rest of the VPC and
all of S3 through the gateway endpoint. They just have no route to the internet.

## Outputs

`vpc_id`, `vpc_cidr_block`, `availability_zones`, `public_subnet_ids`,
`private_subnet_ids`, `workload_subnet_ids`, `workload_subnets_are_public`,
`public_route_table_id`, `private_route_table_ids`, `nat_gateway_ids`,
`nat_gateway_public_ips`, the four tier security group ids plus
`vpc_endpoints_security_group_id`, `s3_gateway_endpoint_id`,
`interface_endpoint_ids`, `flow_log_group_name`.

Consumers should place workloads with `workload_subnet_ids` rather than picking
a tier themselves; it resolves to the private subnets where they exist and the
public ones otherwise. `workload_subnets_are_public` is what tells an ECS
service whether it needs `assign_public_ip` to reach ECR — it never means the
workload is reachable from outside, which only the security groups decide.
