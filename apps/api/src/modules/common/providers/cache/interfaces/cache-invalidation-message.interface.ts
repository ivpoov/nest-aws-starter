export interface CacheInvalidationMessageInterface {
  readonly op: 'delete' | 'deleteByPrefix';
  readonly target: string;
  readonly senderId: string;
}
