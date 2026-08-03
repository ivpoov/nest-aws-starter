export interface OauthProfileInterface {
  readonly providerAccountId: string;
  readonly email: string | null;
  readonly emailVerified: boolean;
  readonly displayName: string;
  readonly avatarUrl: string | null;
}
