export interface UpdatePlanRequestInterface {
  readonly name?: string | undefined;
  readonly description?: string | undefined;
  readonly amountCents?: number | undefined;
  readonly currency?: string | undefined;
  readonly intervalDays?: number | undefined;
  readonly providerRefs?: Record<string, string> | undefined;
}
