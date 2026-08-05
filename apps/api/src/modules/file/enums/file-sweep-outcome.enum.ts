// Per-row disposition of a single orphan-sweep candidate — see
// FileService.sweepOrphans().
export enum FileSweepOutcomeEnum {
  MARKED_READY = 'MARKED_READY',
  DELETED_ABSENT = 'DELETED_ABSENT',
  DELETED_INVALID = 'DELETED_INVALID',
}
