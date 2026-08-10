// Deliberately dependency-free. This produces one coarse label for the session
// list ("Chrome on Windows") and for the new-device comparison — nothing
// branches on it, so a full UA database buys nothing here and the only
// maintained one (ua-parser-js v2) is AGPL-3.0, which an MIT starter cannot
// carry into everyone's production tree.
//
// Fidelity claim, stated narrowly on purpose: the labels below reproduce
// ua-parser-js@2.0.10 exactly for the 29 user agents in
// tests/parse-device.helper.spec.ts, which covers every browser and OS this
// project has an opinion about, the four in-app browsers that dominate mobile
// traffic, and the non-browser clients. A user agent OUTSIDE that set may
// differ — a rarer in-app browser or a niche Chromium fork reads as its
// Chromium/WebKit base rather than by name. On an install that already has
// sessions fingerprinted by ua-parser-js, each affected user gets at most one
// new-device notification, once, the next time they sign in.
//
// Shared between SessionService (writes the fingerprint on session creation)
// and account-security's new-device check (reads it back for comparison) —
// both sides must format the string identically or every login looks like a
// new device.

// Product tokens are matched on their own boundaries, never as substrings: a
// client announcing `EdgeSuffixTrap/1.0` is not Edge, and a `includes('Edg')`
// test said it was. Real UA tokens are delimited by `/`, space, `;`, `)` or
// end-of-string, so a letter or digit on either side means it is a different
// word — which is also why `Edg`, `EdgA` and `EdgiOS` are three entries rather
// than one prefix.
function token(name: string): RegExp {
  return new RegExp(`(?<![A-Za-z0-9])${name}(?![A-Za-z0-9])`);
}

// First match wins, so anything that embeds another product's token must come
// first: every in-app browser and every Chromium fork also spells "Chrome" and
// "Safari" somewhere in its UA string.
const BROWSER_TOKENS: ReadonlyMap<RegExp, string> = new Map([
  [token('FBAV'), 'Facebook'],
  [token('FBAN'), 'Facebook'],
  [token('Instagram'), 'Instagram'],
  [token('EdgiOS'), 'Edge'],
  [token('EdgA'), 'Edge'],
  [token('Edg'), 'Edge'],
  [token('OPiOS'), 'Opera'],
  [token('OPR'), 'Opera'],
  [token('Opera'), 'Opera'],
  [token('SamsungBrowser'), 'Samsung Internet'],
  [token('YaBrowser'), 'Yandex'],
  [token('Vivaldi'), 'Vivaldi'],
  [token('Brave'), 'Brave'],
  [token('Trident'), 'IE'],
  [token('MSIE'), 'IE'],
  [token('FxiOS'), 'Firefox'],
  [token('Firefox'), 'Firefox'],
  // `wv` is the Android WebView marker and has to beat Chrome: an app that
  // embeds a WebView is not the user's browser, and telling them apart is the
  // whole point of a device fingerprint.
  [token('wv'), 'Chrome WebView'],
  [token('CriOS'), 'Chrome'],
  [token('Chrome'), 'Chrome'],
  [token('Safari'), 'Safari'],
]);

// Android and Chrome OS both say "Linux", Ubuntu says "Linux", and iOS says
// "like Mac OS X" — so each of those is tested before the string it contains.
const OS_TOKENS: ReadonlyMap<RegExp, string> = new Map([
  [token('Windows'), 'Windows'],
  [token('Android'), 'Android'],
  [token('CrOS'), 'Chrome OS'],
  [token('iPhone'), 'iOS'],
  [token('iPad'), 'iOS'],
  [token('iPod'), 'iOS'],
  [token('Mac OS'), 'macOS'],
  [token('Ubuntu'), 'Ubuntu'],
  [token('Linux'), 'Linux'],
]);

// The dedicated mobile browsers carry their form factor in their own name
// ("Samsung Internet", "Chrome WebView") and Edge is reported unprefixed on
// every platform; only these three take the prefix.
const MOBILE_PREFIXED: readonly string[] = ['Chrome', 'Firefox', 'Safari'];

const MOBILE_TOKEN: RegExp = token('Mobile');

export function parseDevice(userAgent: string | null): string {
  if (!userAgent) return 'Unknown device';

  const browser: string = matchBrowser(userAgent);
  const os: string = matchToken(userAgent, OS_TOKENS) ?? 'unknown OS';

  return `${browser} on ${os}`.slice(0, 255);
}

function matchBrowser(userAgent: string): string {
  const name: string | null = matchToken(userAgent, BROWSER_TOKENS);

  if (!name) return 'Unknown browser';

  const isMobile: boolean = MOBILE_TOKEN.test(userAgent) && MOBILE_PREFIXED.includes(name);

  return isMobile ? `Mobile ${name}` : name;
}

function matchToken(userAgent: string, tokens: ReadonlyMap<RegExp, string>): string | null {
  for (const [pattern, label] of tokens) {
    if (pattern.test(userAgent)) return label;
  }

  return null;
}
