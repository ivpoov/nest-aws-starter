export function formatMoney(amountCents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(
    amountCents / 100,
  );
}
