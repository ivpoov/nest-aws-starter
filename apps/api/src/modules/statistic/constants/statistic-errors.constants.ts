import type { ErrorArgsInterface } from '@interfaces/error-args.interface.js';

// Not fenced — this is exactly the code the payment-subtracted build must
// still be able to throw (see StatisticService.revenueAvailable).
export const STATISTIC_REVENUE_UNAVAILABLE: ErrorArgsInterface = {
  code: 'STATISTIC_REVENUE_UNAVAILABLE',
  details: 'Revenue statistics are unavailable — the payment module is not installed',
};
