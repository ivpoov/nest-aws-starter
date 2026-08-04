export interface CreateSessionDataInterface {
  readonly userId: string;
  readonly device: string;
  readonly ip: string;
  readonly activeUntil: Date;
  readonly signedAsAdminId?: string | null | undefined;
}
