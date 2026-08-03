// The admin login-as endpoint never returns raw tokens — it returns a
// one-time exchange code redeemed through the same public
// POST /auth/oauth/exchange endpoint the OAuth login flow already uses, so
// tokens never appear in a URL or a response body an admin's browser holds.
export interface LoginAsResponseInterface {
  readonly code: string;
}
