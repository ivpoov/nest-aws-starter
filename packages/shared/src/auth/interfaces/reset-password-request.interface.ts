export interface ResetPasswordRequestInterface {
  readonly userId: string;
  readonly token: string;
  readonly password: string;
}
