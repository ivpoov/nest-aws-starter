# Benchmarks

Numbers, not adjectives. Everything below was measured with
[`scripts/benchmark.mjs`](../scripts/benchmark.mjs) on the machine described in
[Host](#host), and every command on this page is one that was actually run to
produce them.

## What this measures — and what it does not

**Single API instance, local Postgres, local Redis, load generator on the same
laptop. This measures the framework layer, not your infrastructure.**

That sentence is the whole caveat, so it is worth unpacking:

- **One Node process, one core.** The API is not clustered here and Node's
  request handling is single-threaded. During the `health` run the API process
  burned 10.84 CPU-seconds over 10 wall seconds — it is pinned at roughly one
  core, and that core is the ceiling in every number below. Real deployments run
  N tasks behind a load balancer; the interesting figure there is N times this
  one minus coordination, and nothing on this page predicts N.
- **The load generator is a competitor.** autocannon runs on the same 24 logical
  cores as the API, Postgres, Redis, LocalStack and MinIO. It takes CPU the API
  would otherwise have.
- **Zero network.** Every hop is loopback or a container on the same host. There
  is no TLS termination, no ALB, no cross-AZ round trip, no cold connection
  pool at the far end. Add all of those back and latency grows by more than the
  numbers here.
- **A small, warm dataset.** See the per-scenario notes; the list scenario
  returns three rows.

So: use these as a *floor* for the framework overhead this starter adds on top
of Fastify, and as a way to spot a regression between commits. Do not quote them
as capacity planning for anything you intend to deploy.

## The three scenarios

Deliberately different in character, so the numbers bracket the stack rather
than describing one lucky route.

| Scenario | Request | What is on the path |
|---|---|---|
| `health` | `GET /api/v1/health/live` | Fastify routing, the `X-Request-Id` `onRequest` hook, JSON serialization. `@Public()` and `@SkipThrottle()` — no guard, no database, no Redis. The framework floor. |
| `notes` | `GET /api/v1/notes?limit=20` | `AccessGuard`: JWT signature verify **plus** a Redis allowlist lookup on the session, then CASL ability evaluation, then a Prisma cursor query (`where userId, order by id desc, take`) against Postgres, then `class-transformer` serialization. |
| `stats` | `GET /api/v1/admin/statistics/overview` | Admin guard + CASL, then the Redis-backed cache tier. The TypedSQL aggregates behind it run once per 60s TTL, not per request, so this measures the cache path — which is what production serves. |

## Host

| | |
|---|---|
| CPU | AMD Ryzen AI 9 HX PRO 370 w/ Radeon 890M — 12 cores / 24 threads |
| CPU state during the runs | `amd-pstate-epp` driver, `powersave` governor, ACPI platform profile `low-power`, cores pegged at ~2.02 GHz |
| RAM | 58.5 GiB |
| Disk | NVMe (SK hynix HFS002TEJ9X162N) |
| OS | Fedora Linux 44, kernel 7.1.5-201.fc44.x86_64 |
| Node | v24.18.1 |
| autocannon | 8.0.0 |
| Postgres / Redis | `postgres:18` and `redis:8` from `docker-compose.yml`, on the same host |

The frequency line matters. This is a laptop in its low-power profile, capped
near 2 GHz rather than its ~5 GHz boost. The numbers below are therefore
*conservative* — a server-class CPU at full clock will beat them, probably by a
lot. They were not re-run on a faster profile, because a benchmark you can
reproduce on the machine you have is worth more than a bigger number you cannot.

## Method

**Mode: `NODE_ENV=development`, running the compiled build.** The API was started
with `pnpm --dir apps/api run start:prod`, which is `node dist/main.js` — the
script name means "run the built output", not "set NODE_ENV=production". The
environment came from `apps/api/.env.example` unchanged, which ships
`NODE_ENV=development`.

This is deliberate, and it is the honest choice here: `NODE_ENV=production`
trips the boot guard
(`apps/api/src/modules/common/helpers/collect-production-violations.helper.ts`),
which refuses to start while `DATABASE_URL`, `REDIS_URL`, `AUTH_JWT_SECRET` and
friends still hold their development defaults and while `CORS_ORIGINS` points at
loopback. Satisfying it would have meant inventing production-shaped config for
a laptop — real numbers from a fake production.

How much does the mode cost? Grep says: very little on the request path.
`process.env.NODE_ENV` is read in exactly four places outside tests
(`app.config.ts`, `swagger.config.ts`, `production-guard.config.ts`,
`custom-logger.service.ts`), and none of them sits inside a request. The logger's
branch only fires when something logs, and nothing logs per request — there is no
request logging middleware. The visible difference is that `/docs` is registered
in development, which costs a few entries in Fastify's radix tree. Expect the
production-mode numbers to be close, not multiples away; but they were not
measured, so this page does not claim them.

**Warm-up.** Every scenario runs twice. First a 3-second, 10-connection pass
whose results are thrown away, then the 10-second, 50-connection pass that is
reported. The discarded pass exists to let V8 tier up the handlers, fill the
Prisma connection pool, open the Redis connections and populate the statistics
cache key. The gap is not cosmetic — with the `statistic:overview` key evicted,
a single cold request took **22.96 ms** against **4.06 ms** for the next one,
a 5.7x difference. Reporting the cold path as steady state would be a lie in
either direction depending on which one you pick.

Before the warm-up, the script also sends one plain `fetch` per scenario and
requires HTTP 200. That is what produces the response sizes and item counts
printed under the table, and it is why an unseeded database or an expired token
fails with a sentence instead of a row of zeros.

**The rate limiter.** The global throttler allows 100 requests per 60 seconds per
client IP, counted in Redis; only `/health/*` opts out with `@SkipThrottle()`.
Benchmarking the two authenticated scenarios through it would measure the
limiter's refusal, so the script stamps a **distinct `X-Forwarded-For` on every
request** — the same lever `apps/api/test/throttling.e2e-spec.ts` pulls, and the
reason `apps/api/.env.example` ships `TRUST_PROXY=true`. The limiter is not
bypassed: its guard still runs first and still pays its Redis round trip on every
one of those requests. It simply never trips. Any 429 that did slip through is
counted in the `non-2xx` column and makes the script exit non-zero, so a
throttled run can never be mistaken for a fast one.

**Runs are not isolated from the machine.** Nothing else was deliberately loaded,
but this is a desktop OS with a browser and the compose stack running.

## Numbers

Verbatim output of `pnpm run benchmark --url http://127.0.0.1:3123`:

```
host        AMD Ryzen AI 9 HX PRO 370 w/ Radeon 890M (24 logical cores)
            Linux 7.1.5-201.fc44.x86_64, 58.5 GiB RAM
            node v24.18.1, autocannon 8.0.0
target      http://127.0.0.1:3123/api/v1
load        50 connections, 10s measured, 3s warm-up discarded

scenario       req/s   mean ms      p50    p97.5      p99    max ms  non-2xx
----------------------------------------------------------------------------
health         23812      1.39     1.00     3.00     4.00     18.00        0
notes           2029     24.09    23.00    37.00    40.00     63.00        0
stats           1285     38.36    37.00    51.00    53.00     79.00        0

health   /api/v1/health/live → 15 B
notes    /api/v1/notes?limit=20 → 948 B, 3 items
stats    /api/v1/admin/statistics/overview → 19196 B
```

`non-2xx` is zero everywhere: no 429s, no errors, no timeouts. All three latency
distributions are for 50 concurrent connections, so the mean is queueing delay as
much as service time — at 2029 req/s with 50 in flight, ~24 ms mean is exactly
what Little's law predicts, and the single-request latency is far lower (the
`stats` cache hit above measured 4.06 ms end to end from `curl`).

### Run-to-run spread

The same command, five consecutive times against the same server process:

| Run | `health` req/s | `notes` req/s | `stats` req/s |
|---:|---:|---:|---:|
| 1 | 24215 | 2265 | 1345 |
| 2 | 24537 | 2241 | 1332 |
| 3 | 24236 | 2267 | 1255 |
| 4 | 24814 | 2325 | 1355 |
| 5 (above) | 23812 | 2029 | 1285 |

Within one server process the spread is about ±4%. **Across processes it is
much wider:** an earlier server process in the same session, same build, same
commands, measured `health` between 17012 and 20452 req/s across five runs. Two
significant figures is the real resolution of these numbers; treat anything
tighter as noise, and always compare a before and an after within one sitting.

## Reading the numbers

**`health` — ~24k req/s, p99 4 ms.** This is the Fastify + Nest floor with one
core: routing, one `onRequest` hook, a 15-byte JSON body. The API process used
**10.84 CPU-seconds during a 10-second run** (`/proc/<pid>/stat` utime+stime,
delta over the run) — about 108% of one core, so the server, not the load
generator, is the limit here. That measurement came from a run with warm-up
disabled:

```bash
pnpm run benchmark --url http://127.0.0.1:3123 --scenario health --warmup 0
```

**`notes` — ~2.1k req/s, an 11.7x drop from `health`.** Every request pays a JWT
verify, a Redis session-allowlist lookup, a CASL ability check, one Postgres
round trip through Prisma and a `class-transformer` pass, plus the throttler's
own Redis round trip. The page returned is small on purpose: the seeded user
owns 3 notes, so this is 948 bytes over the wire and measures the
*fixed* per-request cost of an authenticated, database-backed list rather than
large-result serialization. (The database on this host also held 510 notes and
8550 users left over from other work; the query is `where userId … order by id
desc limit 20` against an index, so table size is not what is being measured.)

**`stats` — ~1.3k req/s on a cache hit, and the payload is the story.** The
Redis-cached tier removes the aggregate queries entirely — the same endpoint
costs 22.96 ms on a miss and 4.06 ms on a hit — but the response is a **19 KB**
JSON document that still has to be built by `class-transformer` and serialized on
every single request. That is why the cached endpoint is *slower* than the
database-backed list, and it is the useful lesson on this page: past a certain
size, caching the data does nothing about the cost of shipping it.

To reproduce the cold/warm pair, evict the key and time two requests:

```bash
docker exec nest-aws-starter-redis-1 redis-cli del statistic:overview
```

## Reproducing

The infrastructure and environment come from the README's *Local development*
section. With the compose stack up (`docker compose ps` should show `postgres`,
`redis`, `localstack` and `minio` healthy):

```bash
cp apps/api/.env.example apps/api/.env
pnpm install --frozen-lockfile
pnpm run build

pnpm --dir apps/api run db:migrate
pnpm --dir apps/api run db:seed      # creates admin@example.com / DemoAdmin123!

PORT=3123 pnpm --dir apps/api run start:prod
```

Then, from the repository root in a second shell:

```bash
pnpm run benchmark --url http://127.0.0.1:3123
```

Port 3123 is arbitrary — it is only there so the benchmark target does not
collide with a dev server on 3000. Drop `--url` entirely and the script targets
`http://127.0.0.1:3000`, which is where `pnpm --dir apps/api run start:dev`
listens.

Note that `pnpm run benchmark` takes its flags **directly**, without a `--`
separator; pnpm keeps for itself whatever follows a bare `--`.

### Options

```
node scripts/benchmark.mjs --help
```

```
  --url <origin>          API origin, no path       (default http://127.0.0.1:3000)
  --prefix <path>         global prefix + version   (default /api/v1)
  --connections <n>       concurrent connections    (default 50)
  --duration <sec>        measured run, per scenario(default 10)
  --warmup <sec>          discarded run, per scenario (default 3, 0 disables)
  --limit <n>             page size for the list scenario (default 20)
  --scenario <name>       run a subset; repeatable  (health | notes | stats)
  --admin-email <email>   default admin@example.com
  --admin-password <pw>   default DemoAdmin123!
  --user-email <email>    default taylor@example.com
  --user-password <pw>    default DemoUser123!
  --json                  print the raw results as JSON instead of a table
```

`--json` prints the full result set, including throughput in bytes/sec and the
`p97.5`/`p99`/`max` latencies, which is the form to commit somewhere if you want
to diff two commits later.

The script never starts a server, never writes a file and never touches the
database beyond logging in. It authenticates through `POST /auth/login` with the
demo credentials rather than carrying a hardcoded token, so a rotated seed or an
unseeded database is reported as a login failure with the fix, not as a wall of
401s.
