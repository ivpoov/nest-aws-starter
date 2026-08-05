import type { PlanInterface } from '@modules/payment/interfaces/plan.interface.js';

// CASL subject class — the ability metadata target for plan administration.
export class PlanEntity implements PlanInterface {
  declare readonly id: string;
  declare readonly name: string;
  declare readonly description: string;
  declare readonly amountCents: number;
  declare readonly currency: string;
  declare readonly intervalDays: number;
  declare readonly providerRefs: Record<string, string>;
  declare readonly isActive: boolean;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}
