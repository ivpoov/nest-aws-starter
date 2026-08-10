import { parseDevice } from '@helpers/parse-device.helper.js';
import { describe, expect, it } from 'vitest';

// Every expectation below was produced by running the same user agent through
// ua-parser-js@2.0.10 before that dependency was removed, so a session
// fingerprinted by the old parser still compares equal to one fingerprinted by
// this helper and nobody gets a spurious new-device alert. This list IS the
// fidelity claim — the helper is not asserted to match ua-parser-js on agents
// outside it.
describe('parseDevice', () => {
  it.each([
    // Desktop browsers
    [
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      'Chrome on Linux',
    ],
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Chrome on Windows',
    ],
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
      'Edge on Windows',
    ],
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 OPR/116.0.0.0',
      'Opera on Windows',
    ],
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 YaBrowser/24.10.0.0 Safari/537.36',
      'Yandex on Windows',
    ],
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Vivaldi/7.0.3495.11',
      'Vivaldi on Windows',
    ],
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Brave/131',
      'Brave on Windows',
    ],
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
      'Firefox on Windows',
    ],
    [
      'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0',
      'Firefox on Ubuntu',
    ],
    [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
      'Safari on macOS',
    ],
    [
      'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Chrome on Chrome OS',
    ],
    // Internet Explorer — Trident and the older MSIE spelling
    ['Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko', 'IE on Windows'],
    ['Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 6.2; Trident/6.0)', 'IE on Windows'],
    // Mobile browsers
    [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
      'Mobile Safari on iOS',
    ],
    [
      'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
      'Mobile Safari on iOS',
    ],
    [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0 Mobile/15E148 Safari/604.1',
      'Mobile Chrome on iOS',
    ],
    [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/133.0 Mobile/15E148 Safari/605.1.15',
      'Mobile Firefox on iOS',
    ],
    [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 EdgiOS/131.0.0.0 Mobile/15E148 Safari/605.1.15',
      'Edge on iOS',
    ],
    [
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
      'Mobile Chrome on Android',
    ],
    [
      'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36 EdgA/131.0.0.0',
      'Edge on Android',
    ],
    [
      'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36',
      'Samsung Internet on Android',
    ],
    // Embedded browsers — an app hosting a WebView is not the user's browser,
    // and a fingerprint that cannot tell them apart is worth less.
    [
      'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP31.240617.009; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.0.0 Mobile Safari/537.36',
      'Chrome WebView on Android',
    ],
    [
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/470.0.0.34.83;]',
      'Facebook on Android',
    ],
    [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/470.0.0.34.83;FBBV/1234;]',
      'Facebook on iOS',
    ],
    [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 320.0.0.24.104 (iPhone14,3; iOS 17_4; en_US)',
      'Instagram on iOS',
    ],
    // Non-browsers and nonsense
    ['curl/8.6.0', 'Unknown browser on unknown OS'],
    ['PostmanRuntime/7.39.0', 'Unknown browser on unknown OS'],
    [
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Unknown browser on unknown OS',
    ],
    // Token boundaries: a substring match called this one Edge.
    ['EdgeSuffixTrap/1.0', 'Unknown browser on unknown OS'],
  ])('labels %s', (userAgent: string, expected: string) => {
    expect(parseDevice(userAgent)).toBe(expected);
  });

  it('labels a missing user agent', () => {
    expect(parseDevice(null)).toBe('Unknown device');
  });

  // Names are matched as whole tokens, so a client cannot claim another
  // browser's identity by embedding its name in a longer word.
  it.each([
    ['NotChromeAtAll/1.0', 'Chrome'],
    ['SuperSafariClone/2.0', 'Safari'],
    ['FirefoxLike/3.0', 'Firefox'],
    ['MyWvBrowser/1.0', 'WebView'],
  ])('does not match %s as %s', (userAgent: string, notThis: string) => {
    expect(parseDevice(userAgent)).not.toContain(notThis);
  });

  // The column is 255 chars wide and the raw UA is attacker-controlled.
  it('never exceeds the stored column width', () => {
    const flood: string = `Chrome ${'x'.repeat(5000)} Windows`;

    expect(parseDevice(flood).length).toBeLessThanOrEqual(255);
  });
});
