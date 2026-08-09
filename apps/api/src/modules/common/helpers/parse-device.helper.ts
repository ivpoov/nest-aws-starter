// Deliberately dependency-free. This produces one coarse label for the session
// list ("Chrome on Windows") and for the new-device comparison — nothing
// branches on it, so a full UA database buys nothing here and the only
// maintained one (ua-parser-js v2) is AGPL-3.0, which an MIT starter cannot
// carry into everyone's production tree. Labels match what ua-parser-js
// emitted so device fingerprints already stored stay comparable.
//
// Shared between SessionService (writes the fingerprint on session creation)
// and suspicious-activity's new-device check (reads it back for comparison) —
// both sides must format the string identically or every login looks like a
// new device.

// First token that appears wins, so a more specific engine must precede the
// ones whose name it also carries: every Chromium browser spells "Chrome" and
// "Safari" somewhere in its UA string.
const BROWSER_TOKENS: ReadonlyMap<string, string> = new Map([
  ['Edg', 'Edge'],
  ['OPR', 'Opera'],
  ['Opera', 'Opera'],
  ['SamsungBrowser', 'Samsung Internet'],
  ['YaBrowser', 'Yandex Browser'],
  ['Vivaldi', 'Vivaldi'],
  ['FxiOS', 'Firefox'],
  ['Firefox', 'Firefox'],
  ['CriOS', 'Chrome'],
  ['Chrome', 'Chrome'],
  ['Safari', 'Safari'],
]);

// Android says "Linux", Chrome OS says "Linux", and iOS says "like Mac OS X" —
// so each of those has to be tested before the string it also contains.
const OS_TOKENS: ReadonlyMap<string, string> = new Map([
  ['Windows', 'Windows'],
  ['Android', 'Android'],
  ['CrOS', 'Chrome OS'],
  ['iPhone', 'iOS'],
  ['iPad', 'iOS'],
  ['iPod', 'iOS'],
  ['Mac OS', 'macOS'],
  ['Linux', 'Linux'],
]);

// The dedicated mobile browsers carry their form factor in their own name
// ("Samsung Internet"); only these three are reported with the prefix.
const MOBILE_PREFIXED: readonly string[] = ['Chrome', 'Firefox', 'Safari'];

export function parseDevice(userAgent: string | null): string {
  if (!userAgent) return 'Unknown device';

  const browser: string = matchBrowser(userAgent);
  const os: string = matchToken(userAgent, OS_TOKENS) ?? 'unknown OS';

  return `${browser} on ${os}`.slice(0, 255);
}

function matchBrowser(userAgent: string): string {
  const name: string | null = matchToken(userAgent, BROWSER_TOKENS);

  if (!name) return 'Unknown browser';

  const isMobile: boolean = userAgent.includes('Mobile') && MOBILE_PREFIXED.includes(name);

  return isMobile ? `Mobile ${name}` : name;
}

function matchToken(userAgent: string, tokens: ReadonlyMap<string, string>): string | null {
  for (const [token, label] of tokens) {
    if (userAgent.includes(token)) return label;
  }

  return null;
}
