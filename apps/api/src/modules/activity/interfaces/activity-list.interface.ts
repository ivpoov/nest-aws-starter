import type { ActivityInterface } from '@modules/activity/interfaces/activity.interface.js';

export interface ActivityListInterface {
  readonly items: ActivityInterface[];
  readonly nextCursor: string | null;
}
