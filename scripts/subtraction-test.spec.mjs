// Unit tests for the fence stripper in subtraction-test.mjs. Run with
// `node --test scripts/subtraction-test.spec.mjs` (wired into the root
// `test` script); node:test keeps this dependency-free, which matters
// because scripts/ is deliberately outside every workspace.
//
// The balance cases are the reason this file exists: an unbalanced marker
// used to be swallowed, and an unclosed one deleted the rest of the file
// while still reporting success.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { stripFencesInFile } from './subtraction-test.mjs';

const scratch = mkdtempSync(path.join(tmpdir(), 'fence-spec-'));

after(() => rmSync(scratch, { recursive: true, force: true }));

let fileCount = 0;

function fixture(contents) {
  fileCount += 1;

  const filePath = path.join(scratch, `fixture-${fileCount}.ts`);

  writeFileSync(filePath, contents);

  return filePath;
}

describe('stripFencesInFile', () => {
  it('drops a balanced block and the lines around it survive', () => {
    const filePath = fixture(
      [
        'const a = 1;',
        '// <module:demo>',
        'const b = 2;',
        '// </module:demo>',
        'const c = 3;',
      ].join('\n'),
    );

    const hits = stripFencesInFile(filePath, 'demo', true);

    assert.deepEqual(hits, [{ kind: 'block', startLine: 2, endLine: 4 }]);
    assert.equal(readFileSync(filePath, 'utf8'), 'const a = 1;\nconst c = 3;');
  });

  it('drops a single line carrying a trailing marker', () => {
    const filePath = fixture(
      ['import { Bell } from "./bell"; // <module:demo>', 'const a = 1;'].join('\n'),
    );

    const hits = stripFencesInFile(filePath, 'demo', true);

    assert.equal(hits.length, 1);
    assert.equal(hits[0].kind, 'line');
    assert.equal(readFileSync(filePath, 'utf8'), 'const a = 1;');
  });

  it('throws on an unclosed fence instead of deleting the rest of the file', () => {
    const filePath = fixture(
      ['const a = 1;', '// <module:demo>', 'const b = 2;', 'const c = 3;'].join('\n'),
    );

    assert.throws(
      () => stripFencesInFile(filePath, 'demo', true),
      (caught) =>
        caught.message.includes(filePath) &&
        caught.message.includes(':2:') &&
        caught.message.includes('unclosed'),
    );

    // The file is untouched — the throw happens before any write.
    assert.equal(readFileSync(filePath, 'utf8').includes('const c = 3;'), true);
  });

  it('throws on a closing fence with no opener', () => {
    const filePath = fixture(['const a = 1;', '// </module:demo>', 'const b = 2;'].join('\n'));

    assert.throws(
      () => stripFencesInFile(filePath, 'demo', true),
      (caught) => caught.message.includes(filePath) && caught.message.includes(':2:'),
    );
  });

  it('throws on a nested fence for the same module', () => {
    const filePath = fixture(
      ['// <module:demo>', 'const a = 1;', '// <module:demo>', '// </module:demo>'].join('\n'),
    );

    assert.throws(
      () => stripFencesInFile(filePath, 'demo', true),
      (caught) => caught.message.includes(':3:') && caught.message.includes('nested'),
    );
  });

  it('leaves another module fences alone and never rewrites an untouched file', () => {
    const contents = ['// <module:other>', 'const a = 1;', '// </module:other>'].join('\n');
    const filePath = fixture(contents);

    const hits = stripFencesInFile(filePath, 'demo', true);

    assert.deepEqual(hits, []);
    assert.equal(readFileSync(filePath, 'utf8'), contents);
  });

  it('strips the JSX comment variant of the fence', () => {
    const filePath = fixture(
      [
        '<Layout>',
        '  {/* <module:demo> */}',
        '  <Bell />',
        '  {/* </module:demo> */}',
        '</Layout>',
      ].join('\n'),
    );

    stripFencesInFile(filePath, 'demo', true);

    assert.equal(readFileSync(filePath, 'utf8'), '<Layout>\n</Layout>');
  });
});
