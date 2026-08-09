import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// A boot-time property of the deployable artifact, which is why it lives with
// the e2e suite rather than with a module's unit tests: `pnpm install --prod`
// drops devDependencies, so anything main.ts imports at module scope has to be
// a runtime dependency or the container crashes on its first line. Nothing in
// the unit or e2e suites catches that — both run against a full install, and
// both get their polyfills from whatever else happens to pull them in.
const API_ROOT: string = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

interface ManifestInterface {
  readonly dependencies: Record<string, string>;
  readonly devDependencies: Record<string, string>;
}

function readManifest(): ManifestInterface {
  return JSON.parse(readFileSync(path.join(API_ROOT, 'package.json'), 'utf8')) as ManifestInterface;
}

// The path aliases are read from tsconfig rather than hardcoded: `@nestjs/core`
// and `@modules/...` both start with `@`, so the only honest way to tell this
// package's own source from a published scope is the alias table itself.
function aliasPrefixes(): string[] {
  const tsconfig = JSON.parse(readFileSync(path.join(API_ROOT, 'tsconfig.json'), 'utf8')) as {
    compilerOptions: { paths: Record<string, string[]> };
  };

  return Object.keys(tsconfig.compilerOptions.paths).map((pattern: string): string =>
    pattern.replace(/\*$/, ''),
  );
}

// Published packages only: relative paths and aliased imports are this
// package's own source, and `node:` is the platform.
function bareImportsOfMain(): string[] {
  const source: string = readFileSync(path.join(API_ROOT, 'src', 'main.ts'), 'utf8');
  const aliases: string[] = aliasPrefixes();
  const specifiers: string[] = [...source.matchAll(/(?:from\s+|import\s+)'([^']+)'/g)].map(
    (match: RegExpMatchArray): string => match[1] as string,
  );

  return [
    ...new Set(
      specifiers.filter(
        (specifier: string): boolean =>
          !specifier.startsWith('.') &&
          !specifier.startsWith('node:') &&
          !aliases.some((alias: string): boolean => specifier.startsWith(alias)),
      ),
    ),
  ];
}

describe('runtime dependencies', () => {
  it('declares every package main.ts imports as a runtime dependency', () => {
    const manifest: ManifestInterface = readManifest();
    const imported: string[] = bareImportsOfMain();

    expect(imported).toContain('reflect-metadata');
    expect(imported).toContain('dotenv');
    expect(imported).toContain('@nestjs/core');

    for (const specifier of imported) {
      expect(Object.keys(manifest.dependencies)).toContain(specifier);
      expect(Object.keys(manifest.devDependencies)).not.toContain(specifier);
    }
  });
});
