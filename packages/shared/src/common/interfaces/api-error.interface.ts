export interface ApiErrorInterface {
  readonly statusCode: number;
  readonly code: string;
  readonly details: string;
  readonly timestamp: string;
  readonly path: string;
}
