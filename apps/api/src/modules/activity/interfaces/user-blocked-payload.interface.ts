export interface UserBlockedPayloadInterface {
  readonly userId: string;
  readonly actorId: string;
  readonly reason?: string;
}
