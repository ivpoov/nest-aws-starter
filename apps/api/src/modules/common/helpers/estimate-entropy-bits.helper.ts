// How much entropy a secret carries is a property of the process that
// generated it, not of the string — no function can read it off a single
// sample. What a function *can* compute is an upper bound: a secret never
// carries more entropy than its own composition allows. Two ceilings multiply:
//
//   period — length of the shortest block whose repetition rebuilds the
//            string, so `abcabc…` over 60 characters is worth at most 3
//            characters of information, not 60.
//   rate   — bits per character, `ceil(log2(distinct))`: the alphabet the
//            secret actually draws from. Rounding up to the next power of two
//            is a deliberate small-sample allowance — 64 random hex characters
//            miss one of the 16 symbols often enough that `log2(distinct)`
//            alone would reject a fifth of otherwise perfect secrets, and a
//            boot guard that fails on a coin flip is worse than useless.
//
// A flat-looking alphabet can still hide a padded secret, so the rate drops to
// the plug-in Shannon estimate whenever the observed character distribution is
// far from uniform. Shannon is never the primary measure: over a 64-character
// sample it systematically reads low (uniform hex measures ~3.83 bits/char,
// not 4.00), so using it alone would reject good secrets at random.
//
// Measured behaviour against the 256-bit (32-byte) bar the boot guard sets:
//
//   openssl rand -hex 32   (64 chars)  → 256, always     accepted
//   openssl rand -hex 48   (96 chars)  → 384, always     accepted
//   openssl rand -base64 48 (64 chars) → 306..384        accepted
//   openssl rand -base64 32 (44 chars) → 211..264        rejected ~97%
//   'a' × 64                           → 0               rejected
//   'ab' × 32                          → 2               rejected
//   '0123456789abcdef' × 4             → 64              rejected
//   'a' × 32 + 32 random hex           → ~158            rejected
//   32 random alphanumerics            → ~160            rejected
//
// Two honest limits. 44 characters cannot *demonstrate* 256 bits no matter how
// they were generated, so `openssl rand -base64 32` is turned away even though
// it is a genuine 32-byte secret — the guard prints a generator that always
// passes rather than lowering the bar. And the score stays an upper bound: a
// 64-character English sentence scores ~315 and is worth nearer 90. Nothing
// static catches that, which is why the guard also rejects the shipped
// defaults by exact value.
const SKEW_TOLERANCE = 0.85;

export function estimateEntropyBits(secret: string): number {
  if (secret.length === 0) return 0;

  const period: number = findShortestPeriod(secret);
  const frequencies: number[] = countCharacterFrequencies(secret);
  const alphabetRate: number = Math.ceil(Math.log2(frequencies.length));
  const shannonRate: number = computeShannonRate(frequencies, secret.length);
  const isSkewed: boolean = shannonRate < alphabetRate * SKEW_TOLERANCE;

  return Math.floor(period * (isSkewed ? shannonRate : alphabetRate));
}

function findShortestPeriod(secret: string): number {
  for (let period = 1; period < secret.length; period += 1) {
    if (secret.length % period !== 0) continue;
    if (isRepetitionOf(secret, period)) return period;
  }

  return secret.length;
}

function isRepetitionOf(secret: string, period: number): boolean {
  for (let index = period; index < secret.length; index += 1) {
    if (secret[index] !== secret[index - period]) return false;
  }

  return true;
}

function countCharacterFrequencies(secret: string): number[] {
  const counts: Map<string, number> = new Map<string, number>();

  for (const character of secret) {
    counts.set(character, (counts.get(character) ?? 0) + 1);
  }

  return [...counts.values()];
}

function computeShannonRate(frequencies: number[], length: number): number {
  return frequencies.reduce((total: number, count: number): number => {
    const probability: number = count / length;

    return total - probability * Math.log2(probability);
  }, 0);
}
