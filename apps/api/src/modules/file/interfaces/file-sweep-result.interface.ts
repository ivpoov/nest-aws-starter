export interface FileSweepResultInterface {
  readonly markedReadyCount: number;
  readonly deletedAbsentCount: number;
  readonly deletedInvalidCount: number;
  // Rows where sweepOne() threw (e.g. a transient S3 error) — left PENDING,
  // picked up again next run. Counted, never rethrown: one bad row must not
  // abort the rest of the batch.
  readonly failedCount: number;
}
