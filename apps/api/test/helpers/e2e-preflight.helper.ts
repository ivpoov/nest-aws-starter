import { GetTopicAttributesCommand, SNSClient } from '@aws-sdk/client-sns';
import { GetQueueAttributesCommand, SQSClient } from '@aws-sdk/client-sqs';
import { config as loadEnv } from 'dotenv';

// E2E PREFLIGHT (wired as vitest `globalSetup` in vitest.e2e.config.ts): runs
// once before any spec starts. Closes a trap that has cost real time four
// times across v0.4/v0.5: LocalStack can be "running and healthy" per
// `docker compose ps` yet started before docker/localstack/init-aws.sh
// provisioned a queue/topic the current tree needs — the resource simply
// doesn't exist. Left unchecked, that surfaces dozens of specs later as a
// cryptic "queue does not exist" deep inside an unrelated assertion. This
// fails fast, once, with the exact fix.
//
// Scope: only the resources init-aws.sh itself provisions (the two SQS
// queues + the one SNS topic it creates). The S3 bucket has the same
// staleness risk but is already self-healed per-spec by
// ensure-bucket.helper.ts's ensureBucket() (CreateBucketCommand, idempotent)
// — duplicating that check here would add nothing. Postgres/Redis aren't
// checked: any e2e spec's first DB/Redis call already fails immediately and
// loudly (ECONNREFUSED) if either is down — unlike LocalStack, there is no
// "up but stale" middle state to diagnose for them.
//
// Deliberately reads process.env directly instead of importing @configs/* —
// this keeps the file a leaf of test infra with zero imports from
// application modules, so no subtraction-tested module removal (e.g.
// `payment`, whose worktree also unsets SQS_PAYMENT_WEBHOOK_QUEUE_URL) needs
// to fence a reference to it. It also never runs there: subtraction-test.mjs
// only runs unit tests (`pnpm --dir apps/api run test`), never `test:e2e`.

const PREFLIGHT_PREFIX = 'E2E PREFLIGHT:';
const LOCALSTACK_ACCOUNT_ID = '000000000000';
// LocalStack's /_localstack/health starts returning 200 before its ready.d
// init hooks (init-aws.sh) finish provisioning — so a resource can be
// genuinely "not created yet" for a couple seconds on a slow/freshly-started
// container even though nothing is actually stale. Retrying here (bounded,
// and only entered when something is missing — the happy path pays none of
// this) is what keeps this preflight from producing exactly the kind of
// misleading diagnostic it exists to eliminate.
const RETRY_TOTAL_WAIT_MS = 10_000;
const RETRY_INTERVAL_MS = 2_000;

interface ResourceCheckInterface {
  readonly label: string;
  readonly run: () => Promise<void>;
}

export default async function setup(): Promise<void> {
  // globalSetup runs before any spec, and thus before ConfigModule.forRoot()
  // (triggered per-spec by app.factory.ts) has had a chance to load .env —
  // without this, SQS_ENABLED/SNS_ENABLED/etc. all read as unset here and
  // every check below would silently no-op. Same call, same semantics as
  // main.ts's loadEnv(): reads apps/api/.env from cwd, never overrides a
  // var already set in process.env (so CI's job-level env: block wins over
  // whatever a committed .env would say — there isn't one in CI anyway).
  loadEnv();

  const endpoint: string = process.env.AWS_ENDPOINT_URL ?? 'http://localhost:4567';

  await checkReachable(endpoint);

  const missing: string[] = await resolveMissing(buildChecks(endpoint));

  if (missing.length > 0) {
    throw new Error(
      `${PREFLIGHT_PREFIX} LocalStack is up but still missing after ~${RETRY_TOTAL_WAIT_MS / 1000}s ` +
        `(not init-script startup lag — already waited that out): ${missing.join('; ')}. ` +
        'The container was started before the init script provisioned it (a stale ' +
        'container). Fix: docker compose up -d --force-recreate localstack',
    );
  }
}

// Runs every check once; anything that comes back missing (a coded "not
// found"-shaped service response, not a connectivity error — those still
// throw straight through) is retried together on a shared clock, up to
// RETRY_TOTAL_WAIT_MS total, rather than serially per-resource. Returns the
// labels still missing once the budget is exhausted.
async function resolveMissing(checks: ResourceCheckInterface[]): Promise<string[]> {
  let pending: ResourceCheckInterface[] = [];

  for (const check of checks) {
    try {
      await check.run();
    } catch (caught) {
      if (!isServiceResponse(caught)) throw caught;

      pending.push(check);
    }
  }

  const start: number = Date.now();

  while (pending.length > 0 && Date.now() - start < RETRY_TOTAL_WAIT_MS) {
    await delay(RETRY_INTERVAL_MS);

    const stillPending: ResourceCheckInterface[] = [];

    for (const check of pending) {
      try {
        await check.run();

        const elapsedMs: number = Date.now() - start;

        // Not a failure — LocalStack was still initializing, not stale.
        // Debug-level visibility only; nothing here should look alarming.
        console.log(
          `${PREFLIGHT_PREFIX} ${check.label} was missing on the first check but appeared ` +
            `after ${elapsedMs}ms — LocalStack's init script was still running. Continuing.`,
        );
      } catch (caught) {
        if (!isServiceResponse(caught)) throw caught;

        stillPending.push(check);
      }
    }

    pending = stillPending;
  }

  return pending.map((check: ResourceCheckInterface): string => check.label);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Mirrors the compose healthcheck itself (`curl -sf localhost:4566/_localstack/health`)
// so a fully-down LocalStack fails with a distinct, unambiguous message before any
// AWS SDK call is attempted.
async function checkReachable(endpoint: string): Promise<void> {
  try {
    const response: Response = await fetch(`${endpoint}/_localstack/health`, {
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) throw new Error(`health endpoint returned HTTP ${response.status}`);
  } catch (caught) {
    throw new Error(
      `${PREFLIGHT_PREFIX} can't reach LocalStack at ${endpoint} (${(caught as Error).message}). ` +
        'Start the compose stack: docker compose up -d --wait',
    );
  }
}

function buildChecks(endpoint: string): ResourceCheckInterface[] {
  const region: string = process.env.AWS_REGION ?? 'us-east-1';
  const checks: ResourceCheckInterface[] = [];

  if (process.env.SQS_ENABLED === 'true') {
    // Not driven by its own env var — sqs.e2e-spec.ts hardcodes the same
    // name/account id, since the generic SQS provider round-trip test has no
    // dedicated queue-url config.
    checks.push({
      label: 'SQS queue "starter-queue"',
      run: () => checkQueue(region, endpoint, `${endpoint}/${LOCALSTACK_ACCOUNT_ID}/starter-queue`),
    });

    // Empty (not just SQS_ENABLED=false) is the payment module's own
    // "disabled" signal — see payment.config.ts. A subtracted `payment`
    // worktree unsets this var, so skipping here on empty is correct, not
    // just defensive.
    const paymentQueueUrl: string | undefined = process.env.SQS_PAYMENT_WEBHOOK_QUEUE_URL;

    if (paymentQueueUrl) {
      checks.push({
        label: 'SQS queue "starter-payment-webhook-queue" (SQS_PAYMENT_WEBHOOK_QUEUE_URL)',
        run: () => checkQueue(region, endpoint, paymentQueueUrl),
      });
    }
  }

  if (process.env.SNS_ENABLED === 'true') {
    checks.push({
      label: 'SNS topic "starter-topic"',
      run: () => checkTopic(region, endpoint),
    });
  }

  return checks;
}

async function checkQueue(region: string, endpoint: string, queueUrl: string): Promise<void> {
  const client: SQSClient = new SQSClient({ region, endpoint });

  try {
    await client.send(new GetQueueAttributesCommand({ QueueUrl: queueUrl }));
  } finally {
    client.destroy();
  }
}

async function checkTopic(region: string, endpoint: string): Promise<void> {
  const client: SNSClient = new SNSClient({ region, endpoint });
  // Region-matched to the client above (was hardcoded to us-east-1 before —
  // dormant only because .env.example happens to use us-east-1 too; would
  // have disagreed with the client the moment AWS_REGION changed).
  const topicArn: string = `arn:aws:sns:${region}:${LOCALSTACK_ACCOUNT_ID}:starter-topic`;

  try {
    await client.send(new GetTopicAttributesCommand({ TopicArn: topicArn }));
  } finally {
    client.destroy();
  }
}

// A real (reachable) service response — success or a coded service error
// (e.g. QueueDoesNotExist, NotFoundException) — always carries $metadata
// with a numeric httpStatusCode. A connection-level failure (refused,
// timed out, DNS) also produces an object with a $metadata key (AWS SDK v3
// wraps it), but httpStatusCode is undefined there — that's the reliable
// discriminator, not mere key presence.
function isServiceResponse(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('$metadata' in error)) return false;

  const metadata: { httpStatusCode?: number } | undefined = (
    error as { $metadata?: { httpStatusCode?: number } }
  ).$metadata;

  return typeof metadata?.httpStatusCode === 'number';
}
