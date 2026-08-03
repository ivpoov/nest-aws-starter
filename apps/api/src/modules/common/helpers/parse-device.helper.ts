import { UAParser } from 'ua-parser-js';

// Shared between SessionService (writes the fingerprint on session creation) and
// suspicious-activity's new-device check (reads it back for comparison) — both
// sides must format the string identically or every login looks like a new device.
export function parseDevice(userAgent: string | null): string {
  if (!userAgent) return 'Unknown device';

  const parsed = new UAParser(userAgent).getResult();
  const browser: string = parsed.browser.name ?? 'Unknown browser';
  const os: string = parsed.os.name ?? 'unknown OS';

  return `${browser} on ${os}`.slice(0, 255);
}
