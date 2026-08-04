export interface UpdatePlanDataInterface {
  readonly name?: string;
  readonly description?: string;
  readonly amountCents?: number;
  readonly currency?: string;
  readonly intervalDays?: number;
  readonly providerRefs?: Record<string, string>;
}
