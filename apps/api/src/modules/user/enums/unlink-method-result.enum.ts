// Facts the repository reports back from the guarded delete; the service
// decides which domain error each one means (§7 of the backend conventions).
export enum UnlinkMethodResultEnum {
  REMOVED = 'REMOVED',
  NOT_FOUND = 'NOT_FOUND',
  LAST_METHOD = 'LAST_METHOD',
}
