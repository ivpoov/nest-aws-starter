// Domain shape for a single gap-filled day bucket (registrations, new devices).
export interface StatisticsDayPointInterface {
  readonly date: string;
  readonly count: number;
}
