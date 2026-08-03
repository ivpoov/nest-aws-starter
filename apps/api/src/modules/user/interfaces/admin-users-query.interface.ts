export interface AdminUsersQueryInterface {
  readonly limit: number;
  readonly cursor: string | null;
  readonly search: string | null;
}
