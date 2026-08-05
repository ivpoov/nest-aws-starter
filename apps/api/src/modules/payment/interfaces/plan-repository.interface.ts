import type { CursorPaginationInterface } from '@interfaces/cursor-pagination.interface.js';
import type { CreatePlanDataInterface } from '@modules/payment/interfaces/create-plan-data.interface.js';
import type { PlanInterface } from '@modules/payment/interfaces/plan.interface.js';
import type { UpdatePlanDataInterface } from '@modules/payment/interfaces/update-plan-data.interface.js';

export interface PlanRepositoryInterface {
  findActiveById(id: string): Promise<PlanInterface | null>;
  findManyActive(): Promise<PlanInterface[]>;
  // Admin-only reads/writes — any status, not just active.
  findById(id: string): Promise<PlanInterface | null>;
  findManyAfter(pagination: CursorPaginationInterface): Promise<PlanInterface[]>;
  create(data: CreatePlanDataInterface): Promise<PlanInterface>;
  update(id: string, data: UpdatePlanDataInterface): Promise<PlanInterface>;
  setActive(id: string, isActive: boolean): Promise<PlanInterface>;
  deleteById(id: string): Promise<void>;
  hasSubscriptions(id: string): Promise<boolean>;
}
