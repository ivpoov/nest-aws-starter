// The presence gauge contract: a sliding-window Redis sorted set keyed by
// userId, score = last-seen epoch ms. Owned by the token module because the
// JWT guard (core auth path) is the only writer — features only ever read
// through OnlineUsersService, never touch Redis for this key directly.
export interface OnlineUsersRepositoryInterface {
  touch(userId: string): Promise<void>;
  countActive(windowSec: number): Promise<number>;
}
