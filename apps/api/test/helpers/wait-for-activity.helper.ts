export interface WaitForActivityOptionsInterface {
  readonly attempts?: number;
  readonly delayMs?: number;
}

// Activity rows are written by fire-and-forget @OnDomainEvent listeners
// (safeRecord) — an e2e that asserts on a row immediately after the
// triggering request races the listener's DB write, which can lose that
// race on a slower CI runner. `find` is re-run until it returns a truthy
// value or attempts are exhausted; callers supply their own lookup (an
// /admin/activities request, a direct Prisma query, ...) — mirrors the
// waitForAvatar poll in oauth-avatar.e2e-spec.ts.
export async function waitForActivity<T>(
  find: () => Promise<T | null | undefined>,
  options: WaitForActivityOptionsInterface = {},
): Promise<T | null | undefined> {
  const attempts: number = options.attempts ?? 20;
  const delayMs: number = options.delayMs ?? 250;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const found: T | null | undefined = await find();

    if (found) return found;

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  return undefined;
}
