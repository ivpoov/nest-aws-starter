import type { AdminPlanResponseInterface } from './admin-plan-response.interface.js';

export interface AdminPlanListResponseInterface {
  readonly items: AdminPlanResponseInterface[];
  readonly nextCursor: string | null;
}
