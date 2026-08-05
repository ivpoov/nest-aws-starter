export function formatMoney(amountCents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(
      amountCents / 100,
    );
  } catch {
    // Defensive fallback — a currency code Intl doesn't recognize should
    // never crash a tile/chart render.
    return `${(amountCents / 100).toFixed(2)} ${currency}`;
  }
}
