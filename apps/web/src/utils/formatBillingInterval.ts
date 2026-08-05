const DAYS_PER_MONTH = 30;
const DAYS_PER_YEAR = 365;

export function formatBillingInterval(intervalDays: number): string {
  if (intervalDays === DAYS_PER_MONTH) return 'Monthly';
  if (intervalDays === DAYS_PER_YEAR) return 'Yearly';

  return `Every ${intervalDays} days`;
}
