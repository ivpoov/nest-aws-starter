// Integer cents in, localized currency string out — the one money formatter in
// this app. apps/web keeps its own byte-identical copy on purpose: the two
// frontends duplicate rather than share until a third app justifies a package.
export function formatMoney(amountCents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(
      amountCents / 100,
    );
  } catch {
    // Defensive fallback — a currency code Intl doesn't recognize should never
    // crash a render. An admin can type one into the plan form before the
    // backend rejects it, and tiles/charts must survive that.
    return `${(amountCents / 100).toFixed(2)} ${currency}`;
  }
}
