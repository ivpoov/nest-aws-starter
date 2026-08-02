export interface HealthStatusInterface {
  readonly status: 'ok' | 'degraded';
  readonly database: boolean;
  readonly redis: boolean;
}
