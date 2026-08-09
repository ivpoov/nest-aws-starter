// Integer cents in, localized currency string out — the one money formatter in
// this app. apps/admin keeps its own byte-identical copy on purpose: the two
// frontends duplicate rather than share until a third app justifies a package.
export function formatMoney(amountCents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(
      amountCents / 100,
    );
  } catch {
    // Defensive fallback — a currency code Intl doesn't recognize should never
    // crash a render. Plans carry a server-supplied code, but that code comes
    // from an admin-editable field, so it is not guaranteed to be valid ISO-4217.
    return `${(amountCents / 100).toFixed(2)} ${currency}`;
  }
}
