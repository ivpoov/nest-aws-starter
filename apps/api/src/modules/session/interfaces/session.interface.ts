export interface SessionInterface {
  readonly id: string;
  readonly userId: string;
  readonly device: string;
  readonly ip: string;
  readonly createdAt: Date;
  readonly lastActiveAt: Date;
  readonly activeUntil: Date;
}
