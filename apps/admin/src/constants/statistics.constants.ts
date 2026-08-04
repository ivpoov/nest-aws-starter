// Mirrors the backend's STATISTIC_REPORTING_CURRENCY — the API's revenue
// figures (totals.revenue, totals.mrrCents, revenueByPlan) are always in
// this single reporting currency, so the dashboard formats them with it
// rather than carrying a currency field on every value.
export const STATISTICS_REPORTING_CURRENCY = 'USD';
