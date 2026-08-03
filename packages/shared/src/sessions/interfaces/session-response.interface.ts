export interface SessionResponseInterface {
  readonly id: string;
  readonly device: string;
  readonly ip: string;
  readonly createdAt: string;
  readonly lastActiveAt: string;
  readonly isCurrent: boolean;
}
