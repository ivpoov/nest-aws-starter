// Attached to the request by ApiKeyGuard as `request.apiKey` — a service
// principal, distinct from `request.user` (there is no human behind an
// API-key-authenticated request).
export interface ApiKeyPrincipalInterface {
  readonly id: string;
  readonly name: string;
  readonly ownerId: string;
}
