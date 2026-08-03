import type { ActivityResponseInterface } from './activity-response.interface.js';

export interface ActivityListResponseInterface {
  readonly items: ActivityResponseInterface[];
  readonly nextCursor: string | null;
}
