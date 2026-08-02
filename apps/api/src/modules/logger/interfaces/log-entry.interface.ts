export interface LogEntryInterface {
  readonly level: string;
  readonly context: string;
  readonly message: string;
  readonly timestamp: string;
  readonly requestId?: string | undefined;
}
