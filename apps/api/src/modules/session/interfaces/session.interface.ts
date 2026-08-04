export interface SessionInterface {
  readonly id: string;
  readonly userId: string;
  readonly device: string;
  readonly ip: string;
  readonly createdAt: Date;
  readonly lastActiveAt: Date;
  readonly activeUntil: Date;
  // Admin user id when this session was minted by login-as — the source of
  // truth for the access token's optional actAsBy claim.
  readonly signedAsAdminId: string | null;
}
