# Edge module

Serves `apps/web` and `apps/admin` — both plain Vite builds — from private S3
buckets through CloudFront. No compute: a static bundle behind a CDN is the
whole deployment.

Wired from `infra/terraform/edge.tf`. Every input comes from `local.names` and
`local.profile`; nothing in here reads `var.cost_profile`.

## What it creates

| Per site (`web`, `admin`)                | Once, when `domain_name` is set        |
| ---------------------------------------- | -------------------------------------- |
| Private, versioned, encrypted S3 bucket   | ACM certificate **in us-east-1**       |
| Origin Access Control                     | DNS validation records                 |
| CloudFront distribution                   | Route 53 zone (unless one is supplied) |
| Bucket policy scoped to that distribution | A + AAAA alias records per hostname    |

Plus an optional third distribution in front of the ALB — off by default, see
below.

The buckets are readable by exactly one principal: the CloudFront service, and
only from the ARN of the distribution that fronts them. Public access is blocked,
ACLs are disabled (`BucketOwnerEnforced`), and non-TLS requests are denied
outright. Origin Access **Control**, not the deprecated Origin Access Identity.

## Caching

Two behaviours, and the split is the point:

| Path        | Policy                       | Why                                                              |
| ----------- | ---------------------------- | ---------------------------------------------------------------- |
| `/assets/*` | `Managed-CachingOptimized`   | Vite content-hashes these filenames, so they are immutable        |
| everything else | `Managed-CachingDisabled` | `index.html` and every client-side route must never go stale      |

Backwards, this is the classic SPA deploy failure: the shell gets cached at the
edge, the next deploy deletes the asset hashes it references, and returning
visitors get a white screen until the TTL expires. The *default* behaviour is
the no-cache one deliberately — a build layout that emits assets somewhere
unexpected then degrades to "slower than it could be" rather than "broken".

`immutable_path_patterns` is the knob if your build writes hashed files
elsewhere. Only ever point it at content-hashed names.

Compression is on for every behaviour. The origin stores one plain copy and
CloudFront negotiates gzip/brotli per viewer — the same rule the API follows.

## SPA routing

`/orders/42` is not an object in the bucket. A **private** bucket answers a
missing key with `403`, not `404` (404 needs `s3:ListBucket`, which the policy
deliberately does not grant), so both codes are mapped to `/index.html` with a
**200** and `error_caching_min_ttl = 0`.

The 200 matters: the router renders the route client-side, and returning the
original 404 would make browsers and crawlers treat a working page as missing.

## Custom domains

`domain_name` is optional and the null case is not a degraded one:

- **null** — every distribution serves on its AWS-assigned `*.cloudfront.net`
  hostname, on AWS's own certificate. Still HTTPS, still HTTP/2 and HTTP/3. No
  ACM certificate, no hosted zone, no alias records are created at all.
- **set** — one certificate covers every hostname in use, and A/AAAA aliases
  point at the distributions. Aliases rather than CNAMEs so the apex works;
  a CNAME at a zone apex is illegal DNS and is why "www resolves, the bare
  domain doesn't" is such a common outcome.

Two things to know before the first apply:

1. **The certificate must live in us-east-1**, whatever `aws_region` says. This
   is a CloudFront constraint, it applies to nothing else in the stack, and the
   error you get when you ignore it does not mention regions. That is the only
   reason this module demands an `aws.us_east_1` provider alias.
2. **Validation needs working DNS.** If the module created the zone, apply will
   sit waiting for a certificate that can never validate until you point your
   registrar at the `hosted_zone_name_servers` output. It gives up after 30
   minutes rather than the default hour. Pass `hosted_zone_id` instead if you
   already have a delegated zone.

## The ALB distribution

`api_distribution_enabled` puts a third distribution in front of the load
balancer. **Off by default.** The full argument is at the top of `api.tf`; in
short:

- **For** — HTTPS on the API without owning a domain (an ALB's own hostname can
  never have a valid certificate), TLS terminated at the edge, and the ALB can
  then be closed to CloudFront's prefix list and taken off the public internet.
- **Against** — an extra hop and per-request charges on traffic that is almost
  entirely uncacheable, and the API stops seeing client IPs directly: everything
  arrives from an edge location, so rate limiting and audit logs have to trust
  exactly one `X-Forwarded-For` hop. Get that wrong and the limiter is either
  useless or forgeable.

It is off because the demo posture is the cheaper half of that trade, and
because the client-IP change is a security regression if it happens unnoticed.

Caching is disabled on that distribution and stays that way: a shared cache in
front of an authenticated JSON API is how one user gets served another's
response.

## Outputs

No URL in this project is ever hand-copied.

| Output                          | Consumer                                          |
| ------------------------------- | ------------------------------------------------- |
| `site_bucket_names`             | `aws s3 sync` target in the deploy workflow        |
| `site_distribution_ids`         | invalidation after each sync                       |
| `site_urls`                     | smoke checks, `VITE_WEB_APP_URL`                   |
| `api_url`                       | `VITE_API_BASE_URL` (plus the API's `/api/v1`)     |
| `cors_origins`                  | the API's `CORS_ORIGINS`                           |
| `hosted_zone_name_servers`      | registrar delegation                               |

`api_url` is null when the ALB distribution is off; the deploy workflow falls
back to the load balancer URL the compute module exports, which is the one URL
this module cannot know.

## Destroy

The demo profile sets `force_destroy`, so the versioned site buckets are emptied
on the way out and `terraform destroy` actually completes. Production does not:
there, emptying a bucket is a decision, not a side effect.
