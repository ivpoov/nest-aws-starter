export interface GoogleUserinfoInterface {
  readonly sub: string;
  readonly email?: string | undefined;
  readonly email_verified?: boolean | undefined;
  readonly name?: string | undefined;
  readonly picture?: string | undefined;
}
