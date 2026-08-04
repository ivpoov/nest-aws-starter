// Also the shape of the billing-portal response — both endpoints just hand
// the FE a URL to redirect to.
export interface CheckoutResponseInterface {
  readonly url: string;
}
