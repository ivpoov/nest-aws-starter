export interface PlanInterface {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly amountCents: number;
  readonly currency: string;
  readonly intervalDays: number;
  // Keyed by provider name, e.g. { STRIPE: 'price_...' } — a provider reads
  // its own key and ignores the rest.
  readonly providerRefs: Record<string, string>;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
