// Single reporting currency the revenue TypedSQL queries filter to — this
// starter assumes one currency in production (matches every seeded/created
// plan and transaction, all 'USD'). A real multi-currency deployment would
// need per-currency buckets instead of a single amountCents total.
export const STATISTIC_REPORTING_CURRENCY = 'USD';

// Trailing window (days) the overview's revenue KPIs are computed over.
export const STATISTIC_REVENUE_WINDOW_DAYS = 30;
