export interface AdminPlanResponseInterface {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly amountCents: number;
  readonly currency: string;
  readonly intervalDays: number;
  readonly providerRefs: Record<string, string>;
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}
