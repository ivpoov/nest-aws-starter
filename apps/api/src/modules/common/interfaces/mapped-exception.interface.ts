export interface MappedExceptionInterface {
  readonly statusCode: number;
  readonly code: string;
  readonly details: string;
  readonly meta?: Record<string, unknown> | undefined;
}
