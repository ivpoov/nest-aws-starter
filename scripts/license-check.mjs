#!/usr/bin/env node
// Fails the build when a production dependency carries a licence this MIT
// starter cannot pass on to whoever clones it.
//
//   pnpm run license-check
//
// Why this exists as its own gate: osv-scanner and `pnpm audit` answer
// "is anything vulnerable?", and both stayed green while an AGPL-3.0
// package sat in the API's runtime tree. A licence is not an advisory —
// nothing was ever going to report it — and the cost of missing one is
// carried by every person who deploys a fork: AGPL §13 obliges them to
// publish the complete corresponding source of their own derived work,
// inherited silently from a transitive dependency they never chose.
//
// The list below is a denylist, not an allowlist. An allowlist over ~850
// packages fails on every unfamiliar-but-fine licence string and gets
// waived into uselessness within a release; a denylist names the
// obligations this project refuses to inherit and lets everything else
// through.
//
// Not denied, deliberately:
//   * LGPL / MPL-2.0 — file-level and library-level copyleft. They reach
//     modifications of the library itself, not the program that calls it,
//     so shipping them unmodified carries no obligation over the rest of
//     the tree. `@img/sharp-libvips-*` (LGPL-3.0-or-later, the prebuilt
//     libvips binary behind the docs site's image pipeline) is the current
//     example and is fine on those terms.
//   * The permissive families (MIT, ISC, Apache-2.0, BSD, 0BSD, BlueOak,
//     Unlicense, CC0, Python-2.0) — nothing to inherit.
//
// A dual licence (`MIT OR GPL-3.0`) is denied only when EVERY alternative
// is denied: the licensee picks, so one clean option is enough. A compound
// licence (`MIT AND SSPL-1.0`) is denied when ANY part is, because all of
// them apply at once.

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const DENIED = [
  [/^AGPL/i, 'network copyleft — §13 obliges anyone who hosts a fork to publish their source'],
  [/^SSPL/i, 'network copyleft over the entire service stack, and not an OSI licence'],
  [/^GPL[-\d]/i, 'strong copyleft — reaches the whole program that links it'],
  [/^EUPL/i, 'strong copyleft with a network clause'],
  [/^(OSL|RPL|CPAL|CDDL)/i, 'copyleft with per-file or per-deployment source obligations'],
  [/^(BUSL|Elastic|SSPL|PolyForm|Commons-Clause)/i, 'source-available, not an open-source grant'],
  [/-NC(-|$)/i, 'non-commercial only — a fork of this starter could not be sold or hosted'],
  [/^(UNLICENSED|UNKNOWN|SEE LICENSE)/i, 'no licence grant at all — assume all rights reserved'],
];

function readProductionLicenses() {
  const listed = spawnSync('pnpm', ['licenses', 'list', '--prod', '--json'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });

  if (!listed.stdout) {
    console.error('license-check: `pnpm licenses list` produced no output.');
    console.error(listed.stderr ?? '');
    console.error(
      'Run `pnpm install` first — licences are read from node_modules, not the lockfile.',
    );
    process.exit(2);
  }

  return JSON.parse(listed.stdout);
}

// `MIT OR GPL-3.0` → denied only if every alternative is denied.
// `MIT AND SSPL-1.0` → denied if any conjunct is.
function denialReason(expression) {
  const alternatives = expression.replace(/[()]/g, ' ').split(/\s+OR\s+/i);
  const reasons = alternatives.map((alternative) => {
    for (const term of alternative.split(/\s+AND\s+/i)) {
      const rule = DENIED.find(([pattern]) => pattern.test(term.trim()));

      if (rule) return rule[1];
    }

    return null;
  });

  return reasons.every((reason) => reason !== null) ? reasons[0] : null;
}

function collectViolations(byLicense) {
  const violations = [];

  for (const [expression, packages] of Object.entries(byLicense)) {
    const reason = denialReason(expression);

    if (!reason) continue;

    for (const found of packages) {
      violations.push({ name: found.name, versions: found.versions ?? [], expression, reason });
    }
  }

  return violations;
}

const byLicense = readProductionLicenses();
const scanned = Object.values(byLicense).reduce((total, packages) => total + packages.length, 0);
const violations = collectViolations(byLicense);

if (violations.length === 0) {
  console.log(`license-check: ${scanned} production packages, no denied licences.`);
  process.exit(0);
}

console.error(`license-check: ${violations.length} denied licence(s) in the production tree:\n`);

for (const violation of violations) {
  console.error(`  ${violation.name}@${violation.versions.join(', ')}`);
  console.error(`    licence: ${violation.expression}`);
  console.error(`    why:     ${violation.reason}\n`);
}

console.error('Replace the package, pin a release that predates the relicence, or drop the');
console.error('feature. Waiving this gate means shipping the obligation to every fork.');
process.exit(1);
