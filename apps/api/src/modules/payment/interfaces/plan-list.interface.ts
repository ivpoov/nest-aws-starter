import type { PlanInterface } from '@modules/payment/interfaces/plan.interface.js';

export interface PlanListInterface {
  readonly items: PlanInterface[];
  readonly nextCursor: string | null;
}
