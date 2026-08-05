// Sane upper bound for admin-entered prices — $1,000,000.00. Not a business
// rule, just a guard against fat-fingered input (extra zero, wrong unit).
export const PLAN_MAX_AMOUNT_CENTS = 100_000_000;

// intervalDays is provider-agnostic and deliberately NOT restricted to
// {30, 365} — any positive day count is a valid billing interval. The upper
// bound (10 years) only guards against fat-fingered input.
export const PLAN_MAX_INTERVAL_DAYS = 3650;
