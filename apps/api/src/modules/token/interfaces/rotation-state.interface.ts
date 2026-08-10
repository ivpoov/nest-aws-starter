import type { RotationGracePairInterface } from '@modules/token/interfaces/rotation-grace-pair.interface.js';

// Everything a refresh has to know about a session's allowlist, read in one
// go. Both answers come from the same snapshot: reading "is this the current
// token?" and "is there a grace replay for it?" as two round trips let a
// rotation commit in between, and the caller then decided against a state that
// had already stopped being true.
export interface RotationStateInterface {
  readonly isCurrent: boolean;
  // The pair that replaced the presented token, if it is inside its grace
  // window — self-contained, so replaying it needs no further reads.
  readonly replay: RotationGracePairInterface | null;
}
