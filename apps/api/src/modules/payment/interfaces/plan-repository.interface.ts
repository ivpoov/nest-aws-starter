import type { PlanInterface } from '@modules/payment/interfaces/plan.interface.js';

// Deliberately minimal — plans admin CRUD (create/update/deactivate, list for
// admin) lands in PR 8. This PR only needs to resolve a plan for checkout.
export interface PlanRepositoryInterface {
  findActiveById(id: string): Promise<PlanInterface | null>;
  findManyActive(): Promise<PlanInterface[]>;
}
