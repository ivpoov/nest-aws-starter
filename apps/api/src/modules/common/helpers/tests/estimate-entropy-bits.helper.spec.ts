import { estimateEntropyBits } from '@helpers/estimate-entropy-bits.helper.js';
import { describe, expect, it } from 'vitest';

// `openssl rand -hex 48` and `openssl rand -hex 32` shaped fixtures — both
// use all sixteen hex symbols, as any real output of those commands does.
const HEX_96 =
  'd75e83775009476bd493d89108682e707d62a9e0dca64ac74fd297cd5b57587f04caa4a28936b6417e345ebeb99e585e';
const HEX_64 = '8728581037600e0b512a75d80444bd6e5889fd42cff99683aa6f4e4ddcf47608';

describe('estimateEntropyBits', () => {
  it('scores an empty secret at zero', () => {
    expect(estimateEntropyBits('')).toBe(0);
  });

  it('scores a repeated character at zero however long it is', () => {
    expect(estimateEntropyBits('a'.repeat(64))).toBe(0);
    expect(estimateEntropyBits('a'.repeat(512))).toBe(0);
  });

  it('charges a repeated block for one block, not for its repetitions', () => {
    const block: string = '0123456789abcdef';

    expect(estimateEntropyBits(block.repeat(4))).toBe(estimateEntropyBits(block));
  });

  it('discounts a secret padded with a run of one character', () => {
    const padded: string = 'a'.repeat(32) + HEX_64.slice(0, 32);

    expect(estimateEntropyBits(padded)).toBeLessThan(256);
  });

  it('clears 256 bits for the generators the guard recommends', () => {
    expect(estimateEntropyBits(HEX_64)).toBe(256);
    expect(estimateEntropyBits(HEX_96)).toBe(384);
  });

  it('rejects a 32-character alphanumeric password despite its length', () => {
    expect(estimateEntropyBits('Tr0ub4dor3xKzQm9wLpVn2sYbHjCd7Fg')).toBeLessThan(256);
  });
});
