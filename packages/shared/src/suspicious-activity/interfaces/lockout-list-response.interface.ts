import type { LockoutResponseInterface } from './lockout-response.interface.js';

export interface LockoutListResponseInterface {
  readonly items: LockoutResponseInterface[];
}
