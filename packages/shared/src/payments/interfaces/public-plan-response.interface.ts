// The public catalog shape — deliberately narrower than
// AdminPlanResponseInterface: no providerRefs (internal wiring, e.g. a
// Stripe price id) and no isActive (every plan this endpoint returns
// already is active, so the field would be redundant/always-true).
export interface PublicPlanResponseInterface {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly amountCents: number;
  readonly currency: string;
  readonly intervalDays: number;
}
