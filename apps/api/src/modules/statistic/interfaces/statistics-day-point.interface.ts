// Domain shape for a single gap-filled day bucket (registrations, new
// devices, revenue in cents — `count` is the generic bucket value).
export interface StatisticsDayPointInterface {
  readonly date: string;
  readonly count: number;
}
