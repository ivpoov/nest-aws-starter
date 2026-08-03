export interface ErrorArgsInterface {
  readonly code: string;
  readonly details: string;
  readonly meta?: Record<string, unknown> | undefined;
}
