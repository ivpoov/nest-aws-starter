import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Every error code this API can put in a response, paired with the error class
// it is thrown with. The class is what decides the question this spec asks: a
// 4xx is something a client branches on, so it belongs on the wire contract in
// packages/shared; a 5xx is an operator's problem that no client can act on, so
// it does not.
//
// Read off the source rather than imported, because importing every module's
// constants file would drag Nest's DI graph into a unit spec. The regexes only
// have to understand two shapes, both of which the conventions fix in place:
// `export const NAME: ErrorArgsInterface = { code: 'CODE' }` and
// `new SomeError(NAME`.
const API_ROOT: string = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../..',
);

interface ErrorConstantInterface {
  readonly name: string;
  readonly code: string;
}

// Walked with `fs` rather than `import.meta.glob`: this spec wants the file
// TEXT, and the raw form of the glob helper is a Vite-only typing this
// workspace does not carry. Reading the tree directly also means the spec keeps
// working under any runner.
function walk(directory: string): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full: string = path.join(directory, entry.name);

    if (entry.isDirectory()) found.push(...walk(full));
    else if (entry.name.endsWith('.ts')) found.push(full);
  }

  return found;
}

const sourcePaths: string[] = walk(path.resolve(API_ROOT, 'src'));
const constantPaths: string[] = sourcePaths.filter((file: string): boolean =>
  /constants[\\/][a-z0-9-]*errors\.constants\.ts$/.test(file),
);

function declaredConstants(): ErrorConstantInterface[] {
  const declarations: ErrorConstantInterface[] = [];

  for (const file of constantPaths) {
    const source: string = readFileSync(file, 'utf8');
    const pattern: RegExp = /export const (\w+)[^=]*=\s*\{\s*code:\s*'([A-Z0-9_]+)'/g;

    for (const match of source.matchAll(pattern)) {
      declarations.push({ name: match[1] as string, code: match[2] as string });
    }
  }

  return declarations;
}

function throwingClassesByConstant(): Map<string, Set<string>> {
  const classes: Map<string, Set<string>> = new Map();

  for (const file of sourcePaths) {
    if (file.includes(`${path.sep}tests${path.sep}`)) continue;

    const source: string = readFileSync(file, 'utf8');

    for (const match of source.matchAll(/new (\w*Error)\(\s*([A-Z][A-Z0-9_]+)/g)) {
      const name: string = match[2] as string;
      const existing: Set<string> = classes.get(name) ?? new Set<string>();

      existing.add(match[1] as string);
      classes.set(name, existing);
    }
  }

  return classes;
}

// Codes that never reach a client as something to branch on: InternalError maps
// to a 500 whose body is deliberately generic, and the bootstrap guards abort
// the process before it serves anything. Adding a code here is a claim that no
// client will ever need it — make it deliberately.
//
// Entries belonging to a REMOVABLE module carry that module's fence marker.
// Without it the entry outlives the constants file it excuses, and the
// staleness check below fails on every subtracted tree — which is exactly what
// it is for, so the marker is the fix rather than a weaker assertion.
const NEVER_ON_THE_WIRE: ReadonlySet<string> = new Set<string>([
  'INTERNAL_SERVER_ERROR',
  'ACCOUNT_SECURITY_LOCKOUT_COUNTER_UNAVAILABLE',
  'CLOUDFRONT_SIGNER_DISABLED', // <module:cloudfront>
  'HTTP_REQUEST_FAILED',
  'LAMBDA_INVOCATION_FAILED',
  'LAMBDA_PROVIDER_DISABLED',
  'MAIL_TRANSPORT_DISABLED',
  'PRISMA_FOREIGN_TRANSACTION_CONTEXT',
  'S3_PROVIDER_DISABLED',
  'SNS_PROVIDER_DISABLED',
  'SQS_PROVIDER_DISABLED',
  'STRIPE_CHECKOUT_URL_MISSING', // <module:payment>
  // Bootstrap refusals: main.ts exits, so there is no response to carry them.
  'PRODUCTION_DEVELOPMENT_DEFAULT',
  'PRODUCTION_UNAUTHENTICATED_SWAGGER',
  'PRODUCTION_UNSAFE_CORS_ORIGIN',
  'PRODUCTION_WEAK_JWT_SECRET',
]);

function sharedContractCodes(): Set<string> {
  const index: string = readFileSync(
    path.resolve(API_ROOT, '../../packages/shared/src/index.ts'),
    'utf8',
  );
  const codes: Set<string> = new Set<string>();

  for (const match of index.matchAll(/from '(\.\/[^']*error-codes\.constants\.js)'/g)) {
    const relative: string = (match[1] as string).replace(/\.js$/, '.ts');
    const source: string = readFileSync(
      path.resolve(API_ROOT, '../../packages/shared/src', relative.slice(2)),
      'utf8',
    );

    for (const code of source.matchAll(/'([A-Z0-9_]+)'/g)) codes.add(code[1] as string);
  }

  return codes;
}

describe('error code contract', () => {
  const constants: ErrorConstantInterface[] = declaredConstants();
  const throwing: Map<string, Set<string>> = throwingClassesByConstant();
  const contract: Set<string> = sharedContractCodes();

  it('finds the error constants and the shared contract at all', () => {
    expect(constants.length).toBeGreaterThan(50);
    expect(contract.size).toBeGreaterThan(40);
  });

  // The drift this catches is silent by construction: the API keeps working,
  // the frontends keep compiling, and a client simply cannot name the failure
  // it was handed.
  it('puts every client-facing code on the shared wire contract', () => {
    const missing: string[] = constants
      .filter(({ name, code }: ErrorConstantInterface): boolean => {
        if (NEVER_ON_THE_WIRE.has(code)) return false;

        const classes: Set<string> = throwing.get(name) ?? new Set<string>();
        const isInternalOnly: boolean = classes.size > 0 && [...classes].every(isServerError);

        return !isInternalOnly && !contract.has(code);
      })
      .map(({ code }: ErrorConstantInterface): string => code)
      .sort();

    expect(missing).toEqual([]);
  });

  // The other direction: a contract that promises a code no module can emit
  // sends a frontend author writing a branch that never runs.
  it('emits every code the shared contract promises', () => {
    const declared: Set<string> = new Set(
      constants.map(({ code }: ErrorConstantInterface): string => code),
    );
    const phantom: string[] = [...contract]
      .filter((code: string): boolean => !declared.has(code))
      .sort();

    expect(phantom).toEqual([]);
  });

  // An allowlist that outlives the code it excused is how the exclusion grows
  // without anyone deciding to grow it.
  it('keeps no stale entries in the never-on-the-wire list', () => {
    const declared: Set<string> = new Set(
      constants.map(({ code }: ErrorConstantInterface): string => code),
    );
    const stale: string[] = [...NEVER_ON_THE_WIRE]
      .filter((code: string): boolean => !declared.has(code))
      .sort();

    expect(stale).toEqual([]);
  });
});

function isServerError(className: string): boolean {
  return className === 'InternalError';
}
