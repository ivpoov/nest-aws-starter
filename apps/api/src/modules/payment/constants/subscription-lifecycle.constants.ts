// Grace window after currentPeriodEndsAt before the hourly expiry job
// transitions an overdue ACTIVE/PAST_DUE subscription to EXPIRED — gives a
// slow/retried payment or a lagging provider webhook a window to still land
// as a renewal before access is cut off.
export const EXPIRY_GRACE_PERIOD_MS = 3 * 24 * 60 * 60 * 1000;
