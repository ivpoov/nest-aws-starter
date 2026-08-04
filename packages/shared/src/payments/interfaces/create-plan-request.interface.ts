export interface CreatePlanRequestInterface {
  readonly name: string;
  readonly description?: string | undefined;
  readonly amountCents: number;
  readonly currency: string;
  readonly intervalDays: number;
  readonly providerRefs?: Record<string, string> | undefined;
}
