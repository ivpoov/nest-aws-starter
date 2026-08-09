#!/usr/bin/env node

/**
 * Load-tests a *running* API with autocannon and prints one row per scenario.
 *
 *   node scripts/benchmark.mjs
 *   node scripts/benchmark.mjs --url http://127.0.0.1:3100 --duration 30 --connections 100
 *
 * Nothing here starts a server, seeds a database or edits a file: point it at
 * an API that is already up (see docs/benchmarks.md for the exact commands)
 * and it measures. If the API is not up, or the demo seed is missing, or an
 * endpoint answers 401/403/429, it says so and exits non-zero — it never
 * prints a zero and calls it a result.
 *
 * THE THREE SCENARIOS are deliberately different in character, so the numbers
 * bracket the stack instead of describing one lucky route:
 *
 *   health   GET /health/live            no auth, no database, no Redis. The
 *                                        Fastify + Nest floor: routing, the
 *                                        request-id hook, serialization.
 *   notes    GET /notes?limit=N          AccessGuard (JWT verify + a Redis
 *                                        allowlist lookup) + CASL + a Prisma
 *                                        cursor query against Postgres.
 *   stats    GET /admin/statistics/overview
 *                                        admin guard + the Redis-backed cache
 *                                        tier, served from a warm key. The
 *                                        aggregate TypedSQL behind it runs
 *                                        once per 60s TTL, not per request —
 *                                        this measures the cache path, which
 *                                        is what production serves.
 *
 * THE THROTTLER is global (100 req/min per client ip, counted in Redis) and
 * only /health/* opts out. Benchmarking through it would measure the limiter's
 * refusal, not the app, so the two authenticated scenarios send a distinct
 * X-Forwarded-For per request — the same lever apps/api/test/throttling.e2e-spec.ts
 * pulls, and the reason apps/api/.env.example ships TRUST_PROXY=true. The
 * limiter still runs and still pays its Redis round-trip on every request; it
 * is measured, just never tripped. Any 429 that slips through is reported as a
 * failure rather than averaged in.
 *
 * WARM-UP: every scenario runs twice. The first run is a short low-concurrency
 * pass whose numbers are thrown away — it exists to JIT the route handlers,
 * fill the Prisma connection pool, open the Redis connections and populate the
 * statistics cache key. Only the second run is reported. A cold first request
 * measured as steady state is a lie, and the gap is not small.
 */

import { createRequire } from 'node:module';
import os from 'node:os';
import { parseArgs } from 'node:util';
import autocannon from 'autocannon';

const require = createRequire(import.meta.url);

const DEFAULT_URL = 'http://127.0.0.1:3000';
const DEFAULT_PREFIX = '/api/v1';
const DEFAULT_CONNECTIONS = 50;
const DEFAULT_DURATION = 10;
const DEFAULT_WARMUP = 3;
const DEFAULT_LIMIT = 20;
const PREFLIGHT_TIMEOUT_MS = 3000;

const { values } = parseArgs({
  // Tolerated so a stray `--` (as in `pnpm run benchmark -- --duration 30`)
  // is not a crash. Pass flags directly instead — `pnpm run benchmark
  // --duration 30` — because pnpm keeps for itself whatever follows a `--`.
  allowPositionals: true,
  options: {
    url: { type: 'string', default: DEFAULT_URL },
    prefix: { type: 'string', default: DEFAULT_PREFIX },
    connections: { type: 'string', default: String(DEFAULT_CONNECTIONS) },
    duration: { type: 'string', default: String(DEFAULT_DURATION) },
    warmup: { type: 'string', default: String(DEFAULT_WARMUP) },
    limit: { type: 'string', default: String(DEFAULT_LIMIT) },
    'admin-email': { type: 'string', default: 'admin@example.com' },
    'admin-password': { type: 'string', default: 'DemoAdmin123!' },
    'user-email': { type: 'string', default: 'taylor@example.com' },
    'user-password': { type: 'string', default: 'DemoUser123!' },
    scenario: { type: 'string', multiple: true, default: [] },
    json: { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
});

const HELP = `
Usage: node scripts/benchmark.mjs [options]

  --url <origin>          API origin, no path       (default ${DEFAULT_URL})
  --prefix <path>         global prefix + version   (default ${DEFAULT_PREFIX})
  --connections <n>       concurrent connections    (default ${DEFAULT_CONNECTIONS})
  --duration <sec>        measured run, per scenario(default ${DEFAULT_DURATION})
  --warmup <sec>          discarded run, per scenario (default ${DEFAULT_WARMUP}, 0 disables)
  --limit <n>             page size for the list scenario (default ${DEFAULT_LIMIT})
  --scenario <name>       run a subset; repeatable  (health | notes | stats)
  --admin-email <email>   default admin@example.com
  --admin-password <pw>   default DemoAdmin123!
  --user-email <email>    default taylor@example.com
  --user-password <pw>    default DemoUser123!
  --json                  print the raw results as JSON instead of a table

The defaults match a local API started with apps/api/.env.example and a
database seeded by \`pnpm --dir apps/api run db:seed\`.
`;

if (values.help) {
  console.log(HELP.trim());
  process.exit(0);
}

const BASE = values.url.replace(/\/+$/, '');
const PREFIX = `/${values.prefix.replace(/^\/+|\/+$/g, '')}`;
const CONNECTIONS = positiveInt(values.connections, 'connections');
const DURATION = positiveInt(values.duration, 'duration');
const WARMUP = nonNegativeInt(values.warmup, 'warmup');
const PAGE_LIMIT = positiveInt(values.limit, 'limit');

function positiveInt(raw, name) {
  const parsed = Number(raw);

  if (!Number.isInteger(parsed) || parsed < 1) fail(`--${name} must be a positive integer`);

  return parsed;
}

function nonNegativeInt(raw, name) {
  const parsed = Number(raw);

  if (!Number.isInteger(parsed) || parsed < 0) fail(`--${name} must be 0 or a positive integer`);

  return parsed;
}

function fail(message, hint) {
  console.error(`\nbenchmark: ${message}`);
  if (hint) console.error(`\n${hint}\n`);
  process.exit(1);
}

// A fresh /8 address per request. The throttler keys on the first
// X-Forwarded-For hop, so a rotating value gives every request its own budget
// instead of exhausting one after 100 requests.
let ipCounter = 0;

function nextClientIp() {
  ipCounter = (ipCounter + 1) % 16_777_216;

  return `10.${(ipCounter >> 16) & 255}.${(ipCounter >> 8) & 255}.${ipCounter & 255}`;
}

async function request(path, init = {}) {
  const url = `${BASE}${PREFIX}${path}`;
  const headers = { 'x-forwarded-for': nextClientIp(), ...(init.headers ?? {}) };

  let response;

  try {
    response = await fetch(url, {
      ...init,
      headers,
      signal: AbortSignal.timeout(PREFLIGHT_TIMEOUT_MS),
    });
  } catch (error) {
    fail(
      `cannot reach ${url} — ${error instanceof Error ? error.message : String(error)}`,
      [
        'Is the API running? From the repository root:',
        '',
        '  docker compose up -d --wait',
        '  cp apps/api/.env.example apps/api/.env',
        '  pnpm --dir apps/api run db:migrate && pnpm --dir apps/api run db:seed',
        '  pnpm --dir apps/api run start:dev',
        '',
        `Then re-run, pointing --url at it (currently ${BASE}).`,
      ].join('\n'),
    );
  }

  const text = await response.text();
  let body = null;

  try {
    body = text.length > 0 ? JSON.parse(text) : null;
  } catch {
    body = null;
  }

  return { status: response.status, body, bytes: Buffer.byteLength(text) };
}

async function login(email, password, role) {
  const { status, body } = await request('/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (status !== 200 || typeof body?.accessToken !== 'string') {
    fail(
      `login failed for the ${role} account ${email} (HTTP ${status}${
        body?.code ? `, ${body.code}` : ''
      })`,
      [
        'The benchmark logs in through the API rather than carrying a token, so',
        'the demo accounts have to exist. Seed them with:',
        '',
        '  pnpm --dir apps/api run db:seed',
        '',
        'or pass your own credentials via --admin-email / --admin-password /',
        '--user-email / --user-password.',
      ].join('\n'),
    );
  }

  return body.accessToken;
}

// One real request per scenario before any load: it proves the route answers
// 200 for this token, and its response tells the report how much work the
// numbers below actually cover (rows returned, bytes on the wire).
async function probe(scenario) {
  const { status, body, bytes } = await request(scenario.path, { headers: scenario.headers });

  if (status !== 200) {
    fail(
      `${scenario.name}: GET ${PREFIX}${scenario.path} answered ${status}, expected 200`,
      status === 429
        ? 'The rate limiter tripped before the benchmark even started. Wait 60s and retry.'
        : 'Benchmarking a failing endpoint would measure the error path. Fix it first.',
    );
  }

  return { bytes, items: Array.isArray(body?.items) ? body.items.length : null };
}

function run(scenario, seconds, connections) {
  // autocannon treats a present `setupRequest` key as callable even when the
  // value is undefined, so the property is added only when it is wanted.
  const spec = { method: 'GET', path: `${PREFIX}${scenario.path}`, headers: scenario.headers };

  // Re-stamped per request: see the throttler note in the file header.
  if (scenario.rotateClientIp) {
    spec.setupRequest = (req) => ({
      ...req,
      headers: { ...req.headers, 'x-forwarded-for': nextClientIp() },
    });
  }

  return autocannon({
    url: BASE,
    connections,
    duration: seconds,
    pipelining: 1,
    excludeErrorStats: false,
    requests: [spec],
  });
}

function summarize(scenario, result, probed) {
  const bad = result.non2xx + result.errors + result.timeouts;

  return {
    scenario: scenario.name,
    path: `${PREFIX}${scenario.path}`,
    requests: result.requests.total,
    rps: result.requests.average,
    latencyMeanMs: result.latency.mean,
    latencyP50Ms: result.latency.p50,
    latencyP97_5Ms: result.latency.p97_5,
    latencyP99Ms: result.latency.p99,
    latencyMaxMs: result.latency.max,
    throughputBytesPerSec: result.throughput.average,
    non2xx: result.non2xx,
    errors: result.errors,
    timeouts: result.timeouts,
    responseBytes: probed.bytes,
    itemsReturned: probed.items,
    clean: bad === 0,
  };
}

function machine() {
  const cpus = os.cpus();

  return {
    cpu: cpus[0]?.model ?? 'unknown',
    logicalCores: cpus.length,
    memoryGiB: Number((os.totalmem() / 1024 ** 3).toFixed(1)),
    platform: `${os.type()} ${os.release()}`,
    node: process.version,
    autocannon: require('autocannon/package.json').version,
  };
}

function printTable(rows) {
  console.log('');
  console.log(
    `${'scenario'.padEnd(9)}${'req/s'.padStart(11)}${'mean ms'.padStart(10)}` +
      `${'p50'.padStart(9)}${'p97.5'.padStart(9)}${'p99'.padStart(9)}` +
      `${'max ms'.padStart(10)}${'non-2xx'.padStart(9)}`,
  );
  console.log('-'.repeat(76));

  for (const row of rows) {
    console.log(
      row.scenario.padEnd(9) +
        row.rps.toFixed(0).padStart(11) +
        row.latencyMeanMs.toFixed(2).padStart(10) +
        row.latencyP50Ms.toFixed(2).padStart(9) +
        row.latencyP97_5Ms.toFixed(2).padStart(9) +
        row.latencyP99Ms.toFixed(2).padStart(9) +
        row.latencyMaxMs.toFixed(2).padStart(10) +
        String(row.non2xx + row.errors + row.timeouts).padStart(9),
    );
  }

  console.log('');
}

async function main() {
  const specs = machine();

  if (!values.json) {
    console.log('');
    console.log(`host        ${specs.cpu} (${specs.logicalCores} logical cores)`);
    console.log(`            ${specs.platform}, ${specs.memoryGiB} GiB RAM`);
    console.log(`            node ${specs.node}, autocannon ${specs.autocannon}`);
    console.log(`target      ${BASE}${PREFIX}`);
    console.log(
      `load        ${CONNECTIONS} connections, ${DURATION}s measured` +
        `${WARMUP > 0 ? `, ${WARMUP}s warm-up discarded` : ', no warm-up'}`,
    );
  }

  // Liveness before anything else: a connection refused here is a far clearer
  // message than a login that times out.
  const live = await request('/health/live');

  if (live.status !== 200) {
    fail(`${BASE}${PREFIX}/health/live answered ${live.status}, expected 200`);
  }

  const adminToken = await login(values['admin-email'], values['admin-password'], 'admin');
  const userToken = await login(values['user-email'], values['user-password'], 'user');

  const all = [
    {
      name: 'health',
      path: '/health/live',
      headers: {},
      rotateClientIp: false,
    },
    {
      name: 'notes',
      path: `/notes?limit=${PAGE_LIMIT}`,
      headers: { authorization: `Bearer ${userToken}` },
      rotateClientIp: true,
    },
    {
      name: 'stats',
      path: '/admin/statistics/overview',
      headers: { authorization: `Bearer ${adminToken}` },
      rotateClientIp: true,
    },
  ];

  const wanted = values.scenario.length > 0 ? new Set(values.scenario) : null;
  const scenarios = wanted ? all.filter((one) => wanted.has(one.name)) : all;

  if (scenarios.length === 0) fail(`no scenario matched --scenario (try health, notes or stats)`);

  const rows = [];

  for (const scenario of scenarios) {
    const probed = await probe(scenario);

    if (WARMUP > 0) {
      if (!values.json) process.stderr.write(`warming up ${scenario.name}...\n`);
      await run(scenario, WARMUP, Math.min(CONNECTIONS, 10));
    }

    if (!values.json) process.stderr.write(`measuring ${scenario.name}...\n`);
    rows.push(summarize(scenario, await run(scenario, DURATION, CONNECTIONS), probed));
  }

  if (values.json) {
    console.log(
      JSON.stringify(
        { machine: specs, connections: CONNECTIONS, duration: DURATION, results: rows },
        null,
        2,
      ),
    );
  } else {
    printTable(rows);

    for (const row of rows) {
      const size = `${row.responseBytes} B`;
      const items = row.itemsReturned === null ? '' : `, ${row.itemsReturned} items`;
      console.log(`${row.scenario.padEnd(9)}${row.path} → ${size}${items}`);
    }

    console.log('');
  }

  const dirty = rows.filter((row) => !row.clean);

  if (dirty.length > 0) {
    fail(
      `${dirty.map((row) => row.scenario).join(', ')} produced non-2xx responses, errors or ` +
        'timeouts — the numbers above are not a clean measurement',
    );
  }
}

await main();
