import type { SessionInterface } from '@modules/session/interfaces/session.interface.js';

export interface SessionForUserInterface extends SessionInterface {
  readonly isCurrent: boolean;
}
