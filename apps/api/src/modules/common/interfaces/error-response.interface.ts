export interface ErrorResponseInterface {
  readonly statusCode: number;
  readonly code: string;
  readonly details: string;
  readonly meta?: Record<string, unknown> | undefined;
  readonly timestamp: string;
  readonly path: string;
}
