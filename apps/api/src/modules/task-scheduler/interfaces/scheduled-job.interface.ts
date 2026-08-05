// Contract a scheduled job implements to register with the runner. `name`
// doubles as the SchedulerRegistry cron-job name and the Redis lock name
// (`job:<name>`) — it must be unique across the whole app.
export interface ScheduledJobInterface {
  readonly name: string;
  readonly cronExpression: string;
  // Lock TTL guidance: ~2x the job's expected runtime. Omit to use the
  // runner's default — a crashed lock-holder self-heals once the TTL expires.
  readonly lockTtlMs?: number;
  run(): Promise<void>;
}
