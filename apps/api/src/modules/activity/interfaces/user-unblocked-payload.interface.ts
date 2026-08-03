export interface UserUnblockedPayloadInterface {
  readonly userId: string;
  readonly actorId: string;
  readonly reason?: string;
}
